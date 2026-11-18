# `api/v1` in the Python app

The Django app serves the same versioned token API as `laravel/routes/api.php`: the
surface the Kotlin Android client and the browser add-on talk to. The website itself
uses the session, not these routes.

Base path: `/api/v1/`. Everything but `POST /api/v1/auth/token` needs
`Authorization: Bearer <token>`.

## What is the same as Laravel

- **Envelope.** One record is `{"data": {…}}`, a list is `{"data": [...], "links": …, "meta": …}`
  (50 per page, `?page=`), a delete is `204` with no body.
- **Errors.** `401 {"message": "Unauthenticated."}`, `404 {"message": "Not found."}`,
  `422 {"message": "The given data was invalid.", "errors": {"field": ["…"]}}`,
  `429 {"message": "Too Many Attempts."}` with `Retry-After`.
- **Ownership.** Every query runs through `.for_user()`, and a record owned by somebody
  else is a **404, never a 403** — the API must not reveal that the row exists.
- **Throttling.** 6 requests a minute on `auth/token` (the password-guessing surface),
  60 a minute per user per method everywhere else.
- **Tokens.** `POST auth/token` with `email`, `password`, `device_name` returns the raw
  token once; only its SHA-256 hash is stored (`library.ApiToken`). `DELETE auth/token`
  revokes **only** the token that made the request, so other devices stay signed in.
- **Paths and verbs.** The route table in `apps/api/urls.py` is in the same order as the
  Laravel file, with fixed words (`stats`, `current`, `history`, `due`) declared before
  the resource so they are never read as an id.
- **Files.** A receipt or a progress photo is only reachable through its own route, which
  authorizes before it opens the file. Nothing is served from a public URL.

## What is different, and why

The Python app was built from the Daybook reference (Today · Focus · Projects · Notes ·
Money · Training · Library). Its schema is not the Laravel schema, so the translation
happens in `apps/api/serializers.py`. Ids go out as strings, as the clients type them.

| Wire field | Stored as | Note |
| --- | --- | --- |
| `amount_cents` + `type` | one signed `amount_cents` | `deposit`/`transfer_in` are positive, `withdrawal`/`transfer_out` negative. `signed_amount_cents` is also returned. |
| `opening_balance_cents` | `opening_cents` | |
| `archived_at` on an account | `archived` (boolean) | An account with history is archived, not deleted (transactions PROTECT it); that `DELETE` answers `200 {"data": {"outcome": "archived"}}`. |
| `weight_grams` | `kg_x10` (tenths of a kg) | 77,5 kg is `775` stored, `77500` on the wire. |
| `measurements: {waist, chest, hips}` in cm | `waist_mm`, `chest_mm`, `hips_mm` | |
| `focus_minutes`, `break_minutes`, `long_break_minutes`, `cycles_before_long_break` | `focus_min`, `short_min`, `long_min`, `long_every` | |
| `auto_start_breaks` + `auto_start_focus` | one `auto_start` choice (off/breaks/focus/both) | Both booleans are accepted and returned. |
| `alarm_sound` | `sound` | |
| budget "limit" | `Cap` on a category | Monthly only; `period` is always `"monthly"`. |

**Not served here**, because the feature is not in this build (it exists only in the
Laravel app): `pomodoro-live-link`, `workout-reminder-setting`, `workout-entries` and
`workout-entries/due`, `workout-presets`. A request to one of those is a 404.

**Fields a client may send that this app cannot store** are ignored rather than rejected,
as Laravel does: `is_starred` on a note, `ticking_sound`, `ambience` and `blocked_sites`
on a preset, `rpe`, `is_warmup`, `distance_metres` and `duration_seconds` on a set,
`body_fat_permille` on a body entry, `merchant` on a transaction. They are absent from
responses, and every client DTO gives them a default.

## Routes

| Method and path | What it does |
| --- | --- |
| `POST auth/token` | Issue a device token (open, 6/min) |
| `DELETE auth/token` | Revoke this device's token |
| `GET auth/me` | The signed-in user |
| `GET POST notes` · `GET PUT PATCH DELETE notes/{id}` | Notes |
| `GET POST pomodoro-presets` · `GET PUT PATCH DELETE pomodoro-presets/{id}` | Focus presets |
| `GET pomodoro-sessions/stats` | Today, this week, 90 days, by hour, by tag, streak |
| `GET POST pomodoro-sessions` · `GET DELETE pomodoro-sessions/{id}` | Logged intervals |
| `GET POST watch-lists` · `GET PUT PATCH DELETE watch-lists/{id}` | Watch lists |
| `GET POST watch-list-items` · `GET PUT PATCH DELETE watch-list-items/{id}` | Their items |
| `GET POST history-entries` · `GET DELETE history-entries/{id}` | Browsing history |
| `GET POST exercises` · `GET PUT PATCH DELETE exercises/{id}` | Library plus own rows (shared rows are read-only: 403) |
| `GET exercises/{id}/history` | Every finished session with that exercise, plus bests |
| `GET POST workout-routines` · `GET PUT PATCH DELETE workout-routines/{id}` | Routines and their items |
| `GET workout-sessions/current` | The running workout, or `data: null` |
| `GET POST workout-sessions` · `GET PUT PATCH DELETE workout-sessions/{id}` | Workouts |
| `POST workout-sessions/{id}/finish` | End it; sets never ticked off are dropped |
| `GET POST workout-sessions/{id}/sets` · `PUT PATCH DELETE workout-sets/{id}` | Sets; writes answer with `is_record` |
| `GET POST body-metrics` · `GET PUT PATCH DELETE body-metrics/{id}` | Body entries |
| `GET POST progress-photos` · `GET DELETE progress-photos/{id}` · `GET progress-photos/{id}/file` | Photos (multipart `file`) |
| `GET workout-stats` | Volume, sets, categories, calendar, streaks, records |
| `GET POST budget-accounts` · `GET PUT PATCH DELETE budget-accounts/{id}` | Accounts |
| `GET POST budget-transactions` · `GET DELETE budget-transactions/{id}` | Ledger (`?account_id=`, `?category_id=`) |
| `POST budget-transfers` | Between your own accounts; answers with both rows |
| `POST budget-transactions/{id}/receipt` · `GET budget-receipts/{id}/file` · `DELETE budget-receipts/{id}` | Receipts (multipart `file`) |
| `GET POST budget-categories` · `GET PUT PATCH DELETE budget-categories/{id}` | Categories |
| `GET POST budget-limits` · `GET PUT PATCH DELETE budget-limits/{id}` | Monthly caps with `spent_cents`, `percent`, `state` |
| `GET POST budget-goals` · `GET PUT PATCH DELETE budget-goals/{id}` · `POST budget-goals/{id}/contribute` | Goals |
| `GET POST recurring-transactions` · `GET PUT PATCH DELETE recurring-transactions/{id}` · `POST …/confirm` · `POST …/skip` | Recurring items |
| `GET budget-reports?months=6` | Per month, per category, caps |
| `GET budget-due` | Bills due within 7 days, and caps at or over their warning |

`/api/history/` (the add-on's write-only ingest endpoint, with its own hourly limit)
stays where it was and is unchanged.

## CORS

Nothing is allowed by default. Set `EXTENSION_ORIGIN` to the add-on's exact origin
(`chrome-extension://…`) and that **one** origin is allowed — never `*`.

## Verified

`ruff check .` and `pytest` on 18 November 2026: **213 passed**, of which **123 are these
routes** (`apps/api/tests/`). They cover every endpoint in the table above, the envelope and
pagination, both throttles, the 401/404/405/422 paths, every field translation in the table
further up, and a cross-user read for each resource — which must be a 404.

Writing them found two real faults, both now fixed:

- `POST`/`DELETE /api/v1/auth/token` answered **403** to a real client. The dispatcher that
  sends POST to "issue" and DELETE to "revoke" is the view Django's CSRF middleware sees, and
  it was not exempt. Django's test client turns CSRF checks off by default, so the earlier
  manual run never saw it; these tests use `enforce_csrf_checks=True`.
- Serializing a progress photo or a receipt raised `NoReverseMatch` (a **500**): the URL name
  was looked up as `api:v1:…`, but the namespace is `v1:…`.

The token flow was then re-checked against the running server with `curl` — no cookie and no
CSRF token: issue `201`, `auth/me` `200`, `budget-due` `200`, revoke `204`.
