# Deploying the Python app to cPanel

This is the Django app in `django/` on cPanel shared hosting with the **Setup Python App**
tool (CloudLinux Python Selector), which runs it under **Phusion Passenger**.

**Nothing here has been run.** No deployment of this app has happened, and none of these
steps have been verified against a live server — they are written from this repo's own
`passenger_wsgi.py`, `config/settings/*.py`, `scripts/` and `requirements.txt`, and from
the host form's fields. Treat the first run as a trial and read the Passenger log.

Two names stand in for values only you have. Substitute them as you go, and **do not
commit them**:

- `<cpanel-user>` — your cPanel account name, i.e. the owner of `/home/<cpanel-user>`.
  cPanel shows it to you in the grey placeholder of the "Passenger log file" box.
- `<app>` — the folder and virtualenv name. The rest of this document assumes **`jackandpy`**,
  to match the subdomain.

## 1. The Setup Python App form

| Field | Value |
| --- | --- |
| Python version | **3.11.18** — `pyproject.toml` pins `>=3.11,<3.12` |
| Application root | **`jackandpy`** |
| Application URL | the subdomain, e.g. **`jackandpy.fiyobra.co.za`**; leave the path box **empty** |
| Application startup file | **`passenger_wsgi.py`** |
| Application Entry point | **`application`** |
| Passenger log file | **`/home/<cpanel-user>/logs/passenger.log`** |

Three things about those answers:

- **Application root is a folder path**, relative to `/home/<cpanel-user>`. Keep it lowercase
  with no spaces: every command afterwards — the `source …/activate` line, the cron entries,
  `scripts/deploy.sh` — contains this path, and a space in it will break each of them in a
  different way. It must also stay **outside** `public_html` and outside the subdomain's
  document root, so that `.env`, `db.sqlite3` and the source are never downloadable. A bare
  `jackandpy` satisfies that.
- **The startup file and entry point are already in the repo.** `passenger_wsgi.py` puts the
  app root on `sys.path`, sets `DJANGO_SETTINGS_MODULE=config.settings.production` itself, and
  imports `application` from `config/wsgi.py`. Nothing in those two boxes needs to be clever.
- **The log directory must exist** before the app starts. `config/settings/production.py`
  writes to `$LOG_DIR/jackandthings.log` through a `RotatingFileHandler`, which does not
  create its directory; `~/logs` is also where Passenger wants to put the log named above.

Press **Create**, then copy the activation command cPanel prints. It looks like:

```
source /home/<cpanel-user>/virtualenv/jackandpy/3.11/bin/activate && cd /home/<cpanel-user>/jackandpy
```

Every `pip` and `manage.py` command below needs that line first.

## 2. The folders

Over SSH:

```
mkdir -p ~/logs ~/private_media ~/backups
chmod 700 ~/private_media ~/backups
```

`~/private_media` holds progress photos and receipts. They are served only through
authorizing views (`/api/v1/progress-photos/{id}/file`, `/api/v1/budget-receipts/{id}/file`),
never from a public URL, which is why it lives outside the app root as well.

## 3. The code

Deploy the **`deploy/python`** branch, not `main`. CI builds it: it is the contents of
`django/` flattened to the branch root **with `static/dist` committed**, so the server needs
no Node and no `npm run build`. `.github/workflows/python.yml` force-pushes it after the
backend suite, the frontend build and the browser journeys all pass on `main`
(`deploy/python-staging` from `staging` or `dev`). Nothing deploys it automatically.

cPanel has already created the app root, so initialise in place rather than cloning into it:

```
cd ~/jackandpy
git init -q
git remote add origin https://github.com/thabang-teddy/jackandthings.git
git fetch --depth 1 origin deploy/python
git reset --hard FETCH_HEAD
```

The repository is public, so this needs no token. `passenger_wsgi.py` must end up directly in
`~/jackandpy/`, beside `manage.py` — check that before going on.

## 4. The environment file

`config/settings/base.py` reads `.env` in the app root and then **`~/jackandthings.env`**.
Use the second one: it sits outside the app root, outside any document root, and outside git.

```
touch ~/jackandthings.env && chmod 600 ~/jackandthings.env
```

Then fill it in. These are the names the settings read — the values are yours, and none of
them belongs in this repository, in a commit message, or in a chat log:

| Variable | Notes |
| --- | --- |
| `DJANGO_SECRET_KEY` | **Required.** 50+ random characters, used nowhere else. |
| `ADMIN_URL` | **Required.** The admin lives at this path instead of `admin/`. Make it unguessable, no leading slash. |
| `DEFAULT_FROM_EMAIL` | **Required.** Also used as `SERVER_EMAIL`. |
| `ADMINS_EMAIL` | **Required.** Where 500s are mailed. |
| `DJANGO_ALLOWED_HOSTS` | `jackandpy.fiyobra.co.za` (comma-separated if more). |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://jackandpy.fiyobra.co.za` — with the scheme. |
| `DB_ENGINE` | `mysql`. Leaving it out means SQLite in the app root. |
| `DB_NAME`, `DB_USER` | The cPanel-prefixed names, e.g. `<cpanel-user>_jat`. |
| `DB_PASSWORD` | From cPanel's MySQL user screen. |
| `DB_HOST` | `localhost`. |
| `PRIVATE_MEDIA_ROOT` | `/home/<cpanel-user>/private_media`. |
| `LOG_DIR` | `/home/<cpanel-user>/logs`. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_SSL` | cPanel's own mail settings; the defaults are port 465 with SSL. |
| `SECURE_HSTS_SECONDS` | Optional. Starts at `3600`; raise to `31536000` once you are sure about HTTPS. |
| `EXTENSION_ORIGIN` | Only if the browser add-on is ever pointed here: the one exact `chrome-extension://…` origin. Never `*`. |

Create the database and its user in cPanel first (**MySQL Databases**), and grant **all
privileges**. Django needs `CREATE`/`ALTER` for migrations, not just read and write.

## 5. Install, migrate, start

With the virtualenv active and `cd`'d into the app root:

```
pip install -r requirements.txt
python manage.py migrate
python manage.py createcachetable
python manage.py collectstatic --noinput
python manage.py createsuperuser
python manage.py check --deploy
mkdir -p tmp && touch tmp/restart.txt
```

- `createcachetable` is not optional. The cache backend is `DatabaseCache` on the
  `django_cache` table, and the `api/v1` throttles (6/min on `auth/token`, 60/min elsewhere)
  are counted in it — without the table, those requests raise instead of being limited.
- `collectstatic` is still needed even though `static/dist` ships in the branch: it gathers the
  admin's own files, and WhiteNoise serves `STATIC_ROOT` (`staticfiles/`) in production.
- `touch tmp/restart.txt` is how Passenger is restarted — **after every change**, including
  every `git reset --hard` later. cPanel's "Restart" button does the same thing.

Then check it: `https://jackandpy.fiyobra.co.za/healthz/` should answer, and the login page
should render (a blank page with a 404 for a `/static/dist/...` file means the bundle did not
arrive — confirm you are on `deploy/python`, not `main`).

## 6. Cron

Three management commands are meant to run on a schedule. In cPanel's **Cron Jobs**, with
`PYTHON=/home/<cpanel-user>/virtualenv/jackandpy/3.11/bin/python`:

| Schedule | Command |
| --- | --- |
| `*/15 * * * *` | `cd ~/jackandpy && $PYTHON manage.py close_stale_timers >> ~/logs/cron.log 2>&1` |
| `15 0 * * *` | `cd ~/jackandpy && $PYTHON manage.py run_recurring >> ~/logs/cron.log 2>&1` |
| `30 0 * * *` | `cd ~/jackandpy && $PYTHON manage.py purge_history >> ~/logs/cron.log 2>&1` |
| `45 0 * * 0` | `cd ~/jackandpy && $PYTHON manage.py clearsessions >> ~/logs/cron.log 2>&1` |

Write out the interpreter path in full in each line — cron has almost no `PATH`, and no
virtualenv. `run_recurring` is idempotent, so a double run posts nothing twice.

## 7. Backups

`scripts/backup.sh` is written to be copied to the **server** as `~/bin/backup.sh`
(`chmod 700`). Before using it: replace `USER_jat` with your real database name, and create
`~/.my.cnf` (`chmod 600`) holding the database user and password so the dump needs no
password on the command line. It keeps 14 days of gzipped dumps in `~/backups`, plus a weekly
`private_media` tarball. Give it its own daily cron entry, and test a restore once.

## 8. Updating later

```
cd ~/jackandpy
git fetch --depth 1 origin deploy/python
git reset --hard FETCH_HEAD
source /home/<cpanel-user>/virtualenv/jackandpy/3.11/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
touch tmp/restart.txt
```

Back up first — step 7 — because `migrate` is the step that cannot be undone by resetting the
branch. `scripts/deploy.sh` in this repo does the same sequence over SSH from a workstation,
including tagging and a `healthz` check, but it was written for a key-based SSH login to an
app root called `jackandthings`; adjust `VENV` and the paths before trusting it.

## 9. Things that will cost you an hour

- **HTTPS must already work on the subdomain.** `production.py` sets `SECURE_SSL_REDIRECT`
  and secure cookies unconditionally, so without a valid certificate you get a redirect loop
  and no session.
- **Check the MySQL version** (cPanel → Server Information). Django 5.2 requires MySQL 8.0.11+
  or MariaDB 10.5+ and refuses to run on older servers.
- **This account also hosts the sibling project** at `fiyobra`. Give this app its own database,
  its own database user and its own `DJANGO_SECRET_KEY`; share nothing. Whether the two
  projects should share hosting at all is still an open decision in `docs/PRD.md`.
- **The Android client and the browser add-on point at the Laravel app**, not at this one.
  Deploying this changes nothing for them. See `docs/API_V1.md` for where the two `api/v1`
  contracts differ, and for the four endpoints this build does not serve.
- **`seed_demo` only runs with `DEBUG=True`** and is not for a live site; create the real
  account with `createsuperuser` and sign up normally.
- **Read `~/logs/passenger.log` first** when a page 500s. Django's own log is
  `~/logs/jackandthings.log`, and `ADMINS_EMAIL` gets the traceback.
