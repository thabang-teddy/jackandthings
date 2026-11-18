# Jack & Things — the Python web app

The Python port of the website in `../laravel`. Python 3.11, Django 5.2 LTS, inertia-django,
React 19 + TypeScript on Inertia v3, Vite, Tailwind v4, SQLite locally and MariaDB 10.6 in
production. The visual direction is **Daybook** (`../docs/jackandthings-option-1-daybook.pdf`).

It was built from the reference pack at `C:\Users\Teddy\projects\JackAndThings_Python_Path`,
which also holds `LEARNING_PATH.md` (the eighteen stages), `DEPLOYMENT_GODADDY.md` and the
`DOTNET_TO_PYTHON.md` cheat sheet.

Modules: **Today · Focus · Projects · Notes · Money · Training · Library · Settings**, plus
registration, sign-in, email verification and password reset. Everything a user owns is read
through `.for_user()`, and a record owned by somebody else is a **404, never a 403**.

## Run it locally

Two servers: Django serves the pages, Vite serves the assets (the local settings put
django-vite in `dev_mode`). In the Claude Code app, "django" and "django-vite" in
`.claude/launch.json` start both.

```powershell
# once
python3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env            # then put a value on DJANGO_SECRET_KEY
.venv\Scripts\python.exe manage.py migrate
.venv\Scripts\python.exe manage.py createcachetable
npm --prefix frontend install

# every day
.venv\Scripts\python.exe manage.py runserver     # terminal 1 -> http://localhost:8000/
npm --prefix frontend run dev                    # terminal 2 (port 5173)
```

Sample data, so every page has something to draw (development only — it refuses to run with
`DEBUG` off):

```powershell
.venv\Scripts\python.exe manage.py seed_demo --email you@example.com --password <your password>
```

A production-shaped build instead of the dev server:

```powershell
npm --prefix frontend run build    # writes static/dist + manifest.json, which django-vite reads
```

## Checks

```powershell
.venv\Scripts\python.exe -m pytest        # 213 tests
.venv\Scripts\python.exe -m ruff check .
npx --prefix frontend tsc --noEmit        # or: npm --prefix frontend run typecheck
```

Last run on 18 November 2026: **213 passed**, ruff clean, TypeScript clean, `vite build` clean.
Coverage is not measured. 90 of those tests came with the reference pack and cover services,
ownership and auth; the other **123 cover `api/v1`** � every route, both error paths, the
throttles, the field translations and a cross-user 404 for each resource. There are no
browser (end-to-end) tests.

## Layout

```
config/            settings (base/local/test/production), urls, wsgi
apps/core/         ownership base, request helpers, money/date helpers, Now line, private files, middleware
apps/accounts/     user model, auth, settings, account deletion
apps/today/        the Today page
apps/notes/        notes
apps/focus/        pomodoro timer, presets, stats
apps/projects/     boards, cards, card notes, time tracking, calendar, timesheet
apps/money/        accounts, transactions, transfers, categories, caps, goals, recurring, reports, receipts
apps/training/     exercises, routines, live sessions, body, photos, records
apps/library/      watch lists, browsing history, the add-on's ingest endpoint
apps/api/          api/v1 — the token contract for the Android app and the add-on (docs/API_V1.md)
frontend/src/      main.tsx, styles, lib/, components/{ui,layout,projects,money}, pages/<Section>/<Page>.tsx
templates/         base.html (Inertia layout), 404.html, 500.html
scripts/           deploy.sh (run on your machine), backup.sh (copy to the server)
docs/API_V1.md     the token API: what matches Laravel, and every field that is spelled differently
```

## Notes for this machine

- Python 3.11 is at `%LOCALAPPDATA%\Python\pythoncore-3.11-64\python.exe`, and `python3.11`
  resolves in Git Bash. The `python` alias is the Microsoft Store stub, and `py` is 3.9 — neither
  will run Django 5.2.
- `frontend/package.json` pins **rollup 4.68.0** through `overrides`. The newer native binary npm
  downloads is blocked by this machine's Application Control policy ("An Application Control policy
  has blocked this file"), and 4.68.0 is the build that loads. Remove the pin on a machine without
  that policy.
- This app has its own database (`db.sqlite3`); it does not read the Laravel app's.

## Differences from the Laravel app

- **Projects** (boards, cards, card timers, calendar, timesheet) exists here and not there.
- Four Laravel features have no counterpart here, so their endpoints are absent: the Pomodoro
  live link, workout reminder settings, workout presets and quick workout entries.
- Field names on the wire are Laravel's wherever the concept exists; `docs/API_V1.md` has the
  whole mapping.

## Cron jobs (production)

| When | Command |
| --- | --- |
| every 15 min | `manage.py close_stale_timers` |
| daily 00:15 | `manage.py run_recurring` |
| daily 00:30 | `manage.py purge_history` |
| weekly | `manage.py clearsessions` |

`DEPLOYMENT_GODADDY.md` in the reference pack has the exact cPanel lines. **Nothing has been
deployed.**
