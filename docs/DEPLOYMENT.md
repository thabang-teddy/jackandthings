# Deployment

Two long-lived source branches, two artefact branches, and a server that pulls.
Nothing here has been run against a real hosting account yet — see
"Status" at the end before trusting any of it.

## The shape

```
pull request to main / staging   ->  php, js, android, extension checks
                                     (deploy/* PRs are refused by the guard job)

push / merge to staging          ->  checks again
                                     -> force-push deploy/staging
                                     -> account polls and applies it

push / merge to main             ->  checks again
                                     -> force-push deploy/production
                                     -> GitHub Release with a signed APK
```

`deploy/staging` and `deploy/production` are **artefacts, not history**. Each is
the Laravel app flattened to the branch root:

```
artisan  app/  bootstrap/  config/  database/  public/  resources/  routes/
storage/  tests absent  vendor/  public/build/  .env.example  deploy/
```

`vendor/` and `public/build/` are committed because the account has neither
Composer nor Node. `android/`, `extension/`, `docs/` and `tests/` are dropped.
`.env` is never in the artefact: it is git-ignored, written by hand per stage,
and therefore survives every `git reset --hard`.

Never branch off a deploy branch. The guard job exists because merging one
would delete the other surfaces from source.

## One-time setup

### 1. The `staging` branch

The repository has `main` today. `staging` must exist and be pushed before the
workflow can do anything with it:

```bash
git branch staging main
git push -u origin staging
```

### 2. The APK signing key

Android refuses to install an update signed with a different key, and every CI
runner generates its own debug key. The first published APK therefore sets a
signature every later one must match, so the key is created once:

```bash
keytool -genkeypair -v -keystore jack-release.jks \
  -alias jack -keyalg RSA -keysize 2048 -validity 10000

# base64, one line, no wrapping:
base64 -w0 jack-release.jks          # Git Bash / Linux
base64 -i jack-release.jks           # macOS
[Convert]::ToBase64String([IO.File]::ReadAllBytes("jack-release.jks"))  # PowerShell
```

Repository **secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the base64 above |
| `ANDROID_KEYSTORE_PASSWORD` | the store password chosen above |
| `ANDROID_KEY_ALIAS` | `jack` |
| `ANDROID_KEY_PASSWORD` | the key password (same as the store password if you pressed Enter) |

Back up `jack-release.jks` off GitHub. Losing it means no future build can
upgrade an installed copy.

The `apk` job fails, deliberately, when these are absent. It does not block the
web release: `cpanel` and `apk` both depend on the checks, not on each other.

### 3. The APK's API address

Repository **variable** `ANDROID_API_BASE_URL`, e.g. `https://staging.example/api/v1/`.
It is a variable rather than a secret because it also ships inside the APK.

If it is unset the workflow warns and builds against the app's placeholder
default (`https://localhost/api/v1/`), which is useless on a phone — set it
before anyone downloads from the Releases page. The app's sign-in screen lets a
user change the server address, so a wrongly-addressed build is recoverable but
still worth avoiding.

### 4. The cPanel account

Per stage, once:

- **PHP 8.4.1 or newer** selected for the account in cPanel's MultiPHP/PHP
  Selector. This is not optional: `composer.lock` pins the Symfony 8.1 line and
  every package in it requires ≥ 8.4.1. The deploy script reads the version
  through the same selector wrapper that serves web requests, so a cron job and
  a web request can never disagree about which engine runs the app.
- A **read-only** deploy key on the GitHub repository, added to the account.
- A checkout of the artefact branch at `~/staging/jackandthings` or
  `~/production/jackandthings`, checked out **on** `deploy/staging` /
  `deploy/production` so the tree IS the application.
- A `.env` written by hand, containing at minimum `APP_ENV`, `APP_KEY`,
  `APP_URL`, and the database settings. `DB_CONNECTION=sqlite` is now the
  default, and then `DB_DATABASE` must be absolute and **outside** the
  checkout; `deploy/cpanel-deploy.sh` refuses to run otherwise.
- A cron entry, every five minutes, invoking `deploy/cpanel-deploy.sh` with
  `bash`. That is the whole entry point: it takes a lock, fetches the artefact
  branch, hard-resets the tree and applies it. Run it by hand with
  `--apply-only` to re-apply the current checkout during an incident without
  moving it — the flag exists so an incident fix cannot accidentally pull a
  newer release over the one being diagnosed.

The script derives its own path from `$(dirname "${BASH_SOURCE[0]}")`. Do not
template a path in from CI: a path that names the wrong stage migrates the wrong
database.

## Versions and releases

The APK tag is `<major>.<minor>.<run number>` — for example `0.1.412`, where
`0.1` comes from `jackVersionName` in `android/app/build.gradle.kts` and the run
number is GitHub's, so the tag rises on every release. Re-running a workflow
uploads over that tag's assets (`--clobber`) rather than failing on a duplicate
release.

`-PjackVersionCode=<run number>` is passed too, so Android's own version counter
never goes backwards.

To bump the series, edit the literal on the `val jackVersionName` line — the
workflow reads it from there.

## Local equivalents

Everything CI runs, run by hand (see `docs/TESTING.md` for the full record):

```bash
cd laravel && vendor/bin/pint --test && php artisan test && composer audit
cd laravel && npm ci && npm run build
cd android && bash gradlew :app:testDebugUnitTest
cd extension && npm test
```

The release build can be rehearsed without secrets, but it is debug-signed and
must not be handed out:

```bash
cd android && bash gradlew :app:assembleRelease
```

## Status

**Unverified:** the workflow has never executed on GitHub, the artefact has
never been published, and the cPanel side has never been set up. The script in
`deploy/` has been run against a stub PHP on a throwaway clone — enough to
prove its paths, lock, reset and trap, not enough to prove it on the account.
Treat the first real run as a test, not a deployment.

**Known gap:** `npm run lint` is not in the pipeline because it currently fails
on three errors in `resources/js/Pages/Notes/GlassIndexView.jsx`. Fix those and
add it to the `js` job (without `--fix`) — until then the front end is checked
by the Vite build alone.
