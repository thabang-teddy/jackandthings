#!/usr/bin/env bash
#
# Pull the latest release, if there is one, and apply it. Runs ON the cPanel
# account, and is the single entry point for both halves of a deploy.
#
#   bash deploy/cpanel-deploy.sh                 # poll, then apply
#   bash deploy/cpanel-deploy.sh --apply-only    # apply what is checked out
#
# The default mode is what the account-level poller runs every five minutes.
# `--apply-only` is the incident mode: it does not fetch, reset or choose a
# revision, so it re-applies the current checkout without also moving the tree
# to whatever the deploy branch now points at. It takes the same lock, so a
# manual apply cannot interleave with the cron run.
#
# The two used to be separate files for exactly that reason. They are one file
# because the shared half is not trivial — the lock, the failure trap and the
# maintenance-mode bookkeeping are meaningless in one copy without the other,
# and keeping them in step across two files was a standing risk for a script
# that runs 288 times a day.
#
# The checkout IS the application: deploy/staging and deploy/production carry
# the Laravel app flattened to the branch root, so this directory holds
# `artisan` directly rather than a `laravel/` subdirectory.
#
# --------------------------------------------------------------------------
# Why cPanel pulls instead of GitHub pushing
#
# The alternative is an SSH key for the account held as a GitHub Actions
# secret. On shared hosting that key is not scoped to a deploy — it is the
# account: every application on it, every database, every backup. A compromised
# repository, or a workflow anyone can trigger, reaches all of them.
#
# Inverting the direction removes the credential entirely. GitHub pushes only
# to its own repository; cPanel authenticates to GitHub with a READ-ONLY deploy
# key. Neither side holds anything that can damage the other.
#
# The cost is honest: up to five minutes of latency, and a failed deploy
# surfaces in this log rather than in the Actions run. A green tick in Actions
# means the artefact was built, NOT that it is live.
# --------------------------------------------------------------------------

set -euo pipefail

# It locates itself rather than being told where it is. A path templated in
# from CI would decide, in a different repository on a different machine, which
# database this script migrates — and the failure mode of getting it wrong is
# migrating production from a staging deploy. Deriving the path from the
# script's own location cannot disagree with where the script actually is.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${REPO_ROOT}"

# The PHP Selector wrapper, deliberately — NOT a pinned /opt/alt/phpXX path.
#
# On this account the selector has already moved once. A pinned path survives
# that move and becomes the bug it was meant to prevent: cron running one
# engine while web requests run another, with nothing anywhere saying so. The
# wrapper cannot diverge from what serves requests, because it IS what serves
# requests.
#
# MIN_PHP_ID tracks the version CI builds the artefact against (PHP_VERSION in
# .github/workflows/ci.yml). If you change one, change the other — that pairing
# is the whole contract between the machine that builds and the machine that
# runs.
#
# 80401, not the ^8.3 composer.json advertises: the lock pins the Symfony 8.1
# line, every package in it requires PHP >= 8.4.1, and 8.3 cannot even run
# `composer install`. Refusing here is the honest version of that fact.
PHP="${JACK_PHP:-/usr/local/bin/php}"
MIN_PHP_ID=80401

# Named after the tree, not the application. Two stages run from one account and
# must not share a lock: staging deploying is no reason for production to skip
# its release.
LOCK_FILE="${JACK_LOCK:-${HOME}/tmp/$(echo "$REPO_ROOT" | tr '/' '-' | sed 's/^-//').lock}"

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

usage() {
    cat <<'EOF'
usage: deploy/cpanel-deploy.sh [--apply-only]

  (no argument)   fetch the deploy branch and apply it if it moved
  --apply-only    apply the current checkout without fetching or resetting
EOF
}

MODE=poll
while [ $# -gt 0 ]; do
    case "$1" in
        --apply-only) MODE=apply ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; log "Unknown argument: $1"; exit 2 ;;
    esac
    shift
done

# ---------------------------------------------------------------------------
# The lock and the failure trap.
#
# A deploy that overruns the interval must not have the next run start a second
# one on top of it — two `git reset --hard`s and two `migrate`s interleaving
# over one tree is how a half-migrated database ends up serving traffic.
#
# Held on a file descriptor for the life of the process, rather than by
# re-exec'ing under flock. `exec flock ... || fallback` is a common shape and a
# broken one: exec REPLACES this process, so the fallback after it can never
# run, and a busy lock exits non-zero — which for a job that is contended by
# design means cron mails a failure every time the previous deploy is merely
# still working.
#
# A busy lock is a normal outcome here, so it exits 0 and says so.
#
# One trap, not two: only the last EXIT trap registered in bash runs, so an
# apply-stage trap would silently replace a lock-release trap. This one does
# both, and reports the failure in terms of whether the application was
# actually taken down.
# ---------------------------------------------------------------------------
LOCK_DIR=""
MAINTENANCE=0

cleanup() {
    status=$?

    # Released on ANY exit, including a failed deploy. Without this a single
    # crash wedges every subsequent run, silently, until someone finds the
    # directory by hand.
    if [ -n "$LOCK_DIR" ]; then
        rmdir "$LOCK_DIR" 2> /dev/null || true
    fi

    if [ "$status" -ne 0 ]; then
        if [ "$MAINTENANCE" -eq 1 ]; then
            log "FAILED at exit ${status}. Leaving maintenance mode ON deliberately:"
            log '  a half-applied release must not serve traffic. Fix, then re-run'
            log "  this script, or clear it by hand with: ${PHP} artisan up"
        else
            log "FAILED at exit ${status}, before the application was taken down."
            log '  It is still serving the release that was already there.'
        fi
    fi

    exit "$status"
}
trap cleanup EXIT

mkdir -p "$(dirname "$LOCK_FILE")"

if command -v flock > /dev/null 2>&1; then
    exec 9> "$LOCK_FILE"
    if ! flock --nonblock 9; then
        log 'Another deploy holds the lock. Leaving it to finish.'
        exit 0
    fi
else
    # mkdir is atomic on every POSIX filesystem, which is the whole reason it
    # is the fallback rather than `[ -f lock ]`.
    #
    # LOCK_DIR is assigned only AFTER the mkdir succeeds. The cleanup trap
    # removes whatever is in it, so assigning it first — the obvious shape —
    # makes a run that lost the race delete the winner's lock on its way out.
    # That turns the lock into a thing that only works when it is not needed.
    lock_dir="${LOCK_FILE}.d"
    if ! mkdir "$lock_dir" 2> /dev/null; then
        log 'Another deploy holds the lock (mkdir fallback). Leaving it to finish.'
        exit 0
    fi
    LOCK_DIR="$lock_dir"
fi

# ---------------------------------------------------------------------------
# Fetch and move the tree, or don't.
# ---------------------------------------------------------------------------
cd "$REPO_ROOT"

if [ "$MODE" = "poll" ]; then
    branch="$(git rev-parse --abbrev-ref HEAD)"
    remote_ref="$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null || echo "origin/${branch}")"

    git fetch --quiet origin "$branch"

    local_sha="$(git rev-parse HEAD)"
    remote_sha="$(git rev-parse "$remote_ref")"

    if [ "$local_sha" = "$remote_sha" ]; then
        # Deliberately quiet. This runs 288 times a day and all but a few are
        # no-ops; logging each one buries the deploys that matter.
        exit 0
    fi

    log "New release on ${remote_ref}: ${local_sha:0:7} -> ${remote_sha:0:7}"

    # --hard, because the deploy branch is an ARTEFACT that CI force-pushes.
    # Its history is rewritten every build, so merging is meaningless and a
    # fast-forward is not always possible.
    #
    # What survives this: .env and storage/ are git-ignored, and a sqlite
    # database lives outside the tree entirely (checked below).
    git reset --hard "$remote_sha"
else
    log 'Apply-only: no fetch, no reset. Using the checkout as it stands.'
fi

# ---------------------------------------------------------------------------
# Pre-flight. Everything here runs BEFORE the application is taken down.
# ---------------------------------------------------------------------------
[ -x "$PHP" ] || { log "FATAL: no PHP interpreter at ${PHP}. Set JACK_PHP."; exit 1; }
[ -f "${APP}/artisan" ] || { log "FATAL: no artisan at ${APP}. Is this a deploy branch checkout?"; exit 1; }

# Written by hand, once, per stage. Never deployed, never in the artefact.
[ -f "${APP}/.env" ] || { log "FATAL: no .env at ${APP}. See docs/DEPLOYMENT.md."; exit 1; }

php_version="$("$PHP" -r 'echo PHP_VERSION;')"
php_version_id="$("$PHP" -r 'echo PHP_VERSION_ID;')"
if [ "$php_version_id" -lt "$MIN_PHP_ID" ]; then
    log "FATAL: PHP ${php_version} is below the ${MIN_PHP_ID} this artefact was built for."
    exit 1
fi

sha="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
log "Deploying ${sha} into ${APP} using PHP ${php_version} (${PHP})"

# ---------------------------------------------------------------------------
# The database pre-flight.
#
# The default connection is sqlite (config/database.php), and for sqlite
# DB_DATABASE is a FILE. `git reset --hard` runs over the tree that file used to
# live in, so it must be an absolute path OUTSIDE the repository — see
# docs/DEPLOYMENT.md. Checking it here, before migrations run, turns "silently
# migrated a throwaway copy and lost every user" into a refusal.
#
# Any other connection is a server this script cannot touch, so it only has to
# be configured. Applying the absolute-path rule to MySQL would refuse to
# deploy a perfectly good stage for no reason.
# ---------------------------------------------------------------------------
db_connection="$(grep -E '^DB_CONNECTION=' "${APP}/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"'\r ')"
db_connection="${db_connection:-sqlite}"

if [ "$db_connection" = "sqlite" ]; then
    db_path="$(grep -E '^DB_DATABASE=' "${APP}/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"'\r')"

    case "$db_path" in
        /*) : ;;
        *)  log "FATAL: DB_CONNECTION is sqlite, so DB_DATABASE must be an ABSOLUTE path."
            log "       Found: '${db_path:-<unset>}'. A relative path resolves inside"
            log "       the tree this deploy overwrites. See docs/DEPLOYMENT.md."
            exit 1 ;;
    esac

    case "$db_path" in
        "${REPO_ROOT}"/*)
            log "FATAL: DB_DATABASE (${db_path}) is INSIDE the repository."
            log "       git reset --hard would destroy it. Move it to ~/shared/."
            exit 1 ;;
    esac

    [ -f "$db_path" ] || { log "FATAL: DB_DATABASE (${db_path}) does not exist. Create it first: touch it, chmod 660."; exit 1; }
    [ -w "$db_path" ] || { log "FATAL: DB_DATABASE (${db_path}) is not writable by this user."; exit 1; }

    # SQLite writes a journal beside the database, so the DIRECTORY must be
    # writable too — a read-only directory produces "attempt to write a readonly
    # database" on a file that is plainly writable.
    db_dir="$(dirname "$db_path")"
    [ -w "$db_dir" ] || { log "FATAL: ${db_dir} is not writable. SQLite needs to write its journal there."; exit 1; }
else
    db_name="$(grep -E '^DB_DATABASE=' "${APP}/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"'\r')"
    [ -n "$db_name" ] || { log "FATAL: DB_CONNECTION is '${db_connection}' but DB_DATABASE is unset."; exit 1; }
    log "Database connection: ${db_connection} (${db_name}) — untouched by the reset."
fi

# public/build is git-ignored in source and committed in the artefact. Its
# absence means a truncated build, and the symptom is not an error page:
# app.blade.php loads a per-page Vite entry, so a missing manifest renders the
# application with no CSS or JavaScript at all.
[ -f "${APP}/public/build/manifest.json" ] || { log "FATAL: public/build/manifest.json missing from the checkout. The artefact was built without npm run build."; exit 1; }

# ---------------------------------------------------------------------------
# The mail notice.
#
# `log` is the framework default and what .env.example ships, which is right for
# a local checkout and wrong everywhere else: it writes the whole message to
# storage/logs/laravel.log and sends NOTHING. There is no error to find — a
# password reset simply never arrives.
#
# It is a WARNING rather than a refusal on purpose. Registration does not
# require a verified address in this application (`User` does not implement
# MustVerifyEmail), so nothing here depends on mail to work; refusing to deploy
# would be its own outage. It is still almost certainly a misconfiguration.
# ---------------------------------------------------------------------------
mail_mailer="$(grep -E '^MAIL_MAILER=' "${APP}/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"'\r ')"

case "${mail_mailer:-}" in
    log|array|"")
        log "WARNING: MAIL_MAILER='${mail_mailer:-<unset>}' sends no email."
        log '         Password resets and every other notification will be discarded'
        log "         silently. Set MAIL_MAILER=smtp in ${APP}/.env when a mailbox exists." ;;
esac

# ---------------------------------------------------------------------------
# Apply.
# ---------------------------------------------------------------------------
cd "$APP"

# Maintenance mode FIRST. A git reset over a live tree is not an atomic swap,
# and this is the whole mitigation: visitors get a 503 for a few seconds
# instead of new PHP running against a stale route cache.
#
# `|| true` because `down` fails when already down, and a redeploy after a
# failed deploy must not be blocked by its own safety measure. MAINTENANCE is
# set either way: from here on, a failure must not serve traffic.
log 'Entering maintenance mode'
"$PHP" artisan down --retry=15 || true
MAINTENANCE=1

# Clear before caching: a cache left by an experiment would otherwise survive.
#
# Caching config is safe here: nothing outside config/ reads env() (checked when
# this was written — the only application-side call was in a view that no route
# renders, and that file has since gone). If an env() call ever appears in
# application code, Laravel reads it back as null under config:cache, and the
# fix is to move it into a config file rather than to drop this line.
log 'Caching configuration'
"$PHP" artisan config:clear
"$PHP" artisan config:cache

log 'Running migrations'
"$PHP" artisan migrate --force

log 'Caching routes and views'
"$PHP" artisan route:cache
"$PHP" artisan view:cache

log 'Ensuring the storage symlink exists'
"$PHP" artisan storage:link || true

log 'Leaving maintenance mode'
"$PHP" artisan up
MAINTENANCE=0

log "Deployed ${sha} successfully"

# storage/ is NEVER deleted by this script, and neither is the database. The
# database lives outside the tree when it is sqlite (checked above). storage/ is
# inside the tree but git-ignored, so `git reset --hard` leaves it alone — as it
# does .env. If anyone adds a `git clean -fdx` above, that is the line that
# destroys both.
