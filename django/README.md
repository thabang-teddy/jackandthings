# Jack & Things — reference implementation

The finished project that `LEARNING_PATH.md` builds, stage by stage. Python 3.11, Django 5.2 LTS,
inertia-django, React 19 + TypeScript, Inertia v3, Vite, Tailwind v4, MariaDB 10.6 (SQLite locally until Stage 6).

**Use it to check your work, not instead of doing it.** Each stage's files are also printed, complete,
in `stages/STAGE_NN.md` with a sentence on what each file is for.

## Run it locally

```bash
python3.11 -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cp .env.example .env                                       # then edit; SQLite needs nothing else
python manage.py makemigrations accounts core notes focus projects money training library
python manage.py makemigrations training --empty --name seed_exercises   # then see apps/training/migrations/README.md
python manage.py migrate && python manage.py createcachetable && python manage.py createsuperuser
npm --prefix frontend install
python manage.py runserver            # terminal 1
npm --prefix frontend run dev         # terminal 2 → open http://localhost:8000/
pytest                                # tests
```

Migrations are not included on purpose: generating them (and reading them with `sqlmigrate`) is part of every stage.

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
apps/library/      watch lists, browsing history, extension API
frontend/src/      main.tsx, styles, lib/, components/{ui,layout,projects,money}, pages/<Section>/<Page>.tsx
templates/         base.html (Inertia layout), 404.html, 500.html
scripts/           deploy.sh (run on your machine), backup.sh (copy to the server)
```

## Cron jobs (production)

| When | Command |
| --- | --- |
| every 15 min | `manage.py close_stale_timers` |
| daily 00:15 | `manage.py run_recurring` |
| daily 00:30 | `manage.py purge_history` |
| weekly | `manage.py clearsessions` |

See `DEPLOYMENT_GODADDY.md` for the exact cPanel lines.

## How this code was checked

`ruff check .` and `mypy --check-untyped-defs` (with Django treated as untyped) pass; the pure helper tests
(money, dates, units) pass; the TypeScript compiles under `tsc --strict` against stand-in type declarations.
The Django test suite and the browser build were **not** run where this was written (no package downloads were
possible). Run `pytest` and `npm --prefix frontend run build` yourself after installing — that is your Stage 2
and Stage 4 checkpoint anyway.
