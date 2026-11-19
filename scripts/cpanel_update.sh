#!/usr/bin/env bash
#
# Run this ON THE SERVER, from the cPanel application root, to put the current
# deploy branch live:
#
#   cd ~/jackandpy && bash scripts/cpanel_update.sh
#
# It is the sequence in docs/DEPLOY_CPANEL.md with the ordering mistakes made
# impossible: nothing migrates before the backup, nothing restarts before the
# checks pass, and it refuses to start at all if this is not an app root or the
# environment file is missing.
#
# Safe to run twice. Every step is idempotent, and it changes nothing until the
# first `git reset` — a failure before that leaves the running site alone.
#
# Settings it reads, all optional:
#   DEPLOY_BRANCH   branch to pull (default: deploy/python)
#   PYBIN           python to use  (default: the virtualenv guessed from $PWD)
#   APP_URL         probed at the end, e.g. https://jackandpy.fiyobra.co.za
#   SKIP_BACKUP=1   skip ~/bin/backup.sh (it is run when present)
#
# NOT the same file as scripts/deploy.sh, which runs on a workstation and drives
# a server over SSH. This one runs where the app lives and talks to nothing.
set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-deploy/python}"
ROOT="$(pwd)"
APP="$(basename "$ROOT")"
ENV_FILE="$HOME/jackandthings.env"

step() { printf '\n=== %s\n' "$1"; }
die()  { printf '\n!! %s\n' "$1" >&2; exit 1; }

# --- Before anything is touched ---------------------------------------------

step "Checking where we are"
[ -f manage.py ] && [ -f passenger_wsgi.py ] \
  || die "No manage.py/passenger_wsgi.py here. Run this from the application root."
[ -d .git ] || die "$ROOT is not a git checkout. See docs/DEPLOY_CPANEL.md section 3."
[ -f "$ENV_FILE" ] \
  || die "Missing $ENV_FILE. production.py needs DJANGO_SECRET_KEY, ADMIN_URL,
     DEFAULT_FROM_EMAIL and ADMINS_EMAIL, and will not start without them."

# The virtualenv cPanel made is ~/virtualenv/<app root>/<python version>/.
# Guessing it from the folder name is right for every layout the docs describe,
# and PYBIN overrides it when it is not.
if [ -z "${PYBIN:-}" ]; then
  # A glob, not `find -type f`: bin/python in a virtualenv is a symlink, and -x
  # follows it. The last match wins, so 3.11 beats 3.9 if both are there.
  shopt -s nullglob
  for candidate in "$HOME/virtualenv/$APP"/*/bin/python; do
    [ -x "$candidate" ] && PYBIN="$candidate"
  done
  shopt -u nullglob
fi
[ -n "$PYBIN" ] && [ -x "$PYBIN" ] \
  || die "No interpreter found under ~/virtualenv/$APP. Set PYBIN=/full/path/to/python."
step "Using $PYBIN"
"$PYBIN" -c 'import sys; print("Python", ".".join(map(str, sys.version_info[:3])))'

if [ -x "$HOME/bin/backup.sh" ] && [ "${SKIP_BACKUP:-0}" != "1" ]; then
  step "Backing up first"
  "$HOME/bin/backup.sh"
else
  printf '\n-- No ~/bin/backup.sh (or SKIP_BACKUP=1). Migrations will not be undoable.\n'
fi

# --- The deploy --------------------------------------------------------------

step "Fetching $BRANCH"
git fetch --depth 1 origin "$BRANCH"
OLD="$(git rev-parse --short HEAD 2>/dev/null || echo none)"
git reset --hard FETCH_HEAD
printf '   %s -> %s\n' "$OLD" "$(git rev-parse --short HEAD)"

# cPanel pre-creates its own passenger_wsgi.py, which loads itself by name and so
# recurses until Python gives up ("RecursionError: maximum recursion depth exceeded"
# in the Passenger log, over and over). This app's entry point imports config.wsgi.
# If the stub is still here after the reset, the branch did not land in this folder.
grep -q 'config.wsgi' passenger_wsgi.py \
  || die "passenger_wsgi.py here is not this app's entry point — it still looks like
     cPanel's stub, which recurses into itself. The deploy branch did not land in
     $ROOT. See docs/DEPLOY_CPANEL.md section 10."

step "Installing dependencies"
"$PYBIN" -m pip install --quiet --upgrade pip
"$PYBIN" -m pip install --quiet -r requirements.txt

step "Migrating"
"$PYBIN" manage.py migrate --noinput

# The api/v1 throttles are counted in the DatabaseCache table, so a missing
# table is a 500 on every throttled request, not a slow one. Already-exists is
# the normal answer here and is not a failure.
step "Making sure the cache table exists"
"$PYBIN" manage.py createcachetable

step "Collecting static files"
"$PYBIN" manage.py collectstatic --noinput

step "Checking the deployment"
"$PYBIN" manage.py check --deploy

# --- Live --------------------------------------------------------------------

step "Restarting Passenger"
mkdir -p tmp && touch tmp/restart.txt

if [ -n "${APP_URL:-}" ]; then
  step "Probing $APP_URL/healthz/"
  sleep 3   # Passenger boots the new process on the first request after restart
  curl -fsS --max-time 20 "$APP_URL/healthz/" && printf '\n'
fi

printf '\nDone: %s is live at %s\n' "$(git rev-parse --short HEAD)" "$ROOT"
