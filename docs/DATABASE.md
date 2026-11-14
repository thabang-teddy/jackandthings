# Database

## Storage model
- Database/provider: **SQLite** via Laravel's `sqlite` driver (built). One file at `laravel/database/database.sqlite`, git-ignored (`database/.gitignore`) and created by `composer.json`'s post-create-project script. It is the connection for local development and for the PHPUnit suite (`phpunit.xml` pins `:memory:`); nothing in the schema or queries is engine-specific.
- Ownership model: Multi-tenant — each row is owned by exactly one user account; no shared/family ownership (confirmed via owner's answer: "Multi-tenant, separate accounts per user").
- Key types: `users.id` stays Laravel's `bigIncrements` (so Breeze's `sessions` table and Sanctum's `tokenable` morphs work unchanged). **Every module table uses UUIDv7 primary keys** (`HasUuids`) so record ids in URLs and API responses are not enumerable; their `user_id` is a `foreignId` to `users`. Two tables deviate, both deliberately: `exercises.user_id` is nullable (the seeded catalog has no owner) and `workout_routine_items` has no `user_id` at all (it is reached only through its routine).
- Data classification:
  - Sensitive: Budget accounts/transactions (financial), Clipboard contents (may contain passwords or other sensitive text), **body metrics and progress photos** (health data; the photo files are the only user data stored outside the database), auth credentials.
  - Personal: Notes, Workout entries, workout sessions and sets, History/URLs.
  - Internal: Pomodoro presets/sessions, the seeded exercise catalog (reference data, owned by nobody).

## SQLite specifics
- Connection settings: `config/database.php` opens the file with `busy_timeout` 5000 ms, `journal_mode` WAL and `synchronous` NORMAL, each overridable with `DB_BUSY_TIMEOUT`, `DB_JOURNAL_MODE` and `DB_SYNCHRONOUS`. The app writes from three places at once (web requests, the queue worker, the scheduler's `history:prune`), so a writer waits for the lock instead of failing with "database is locked". WAL keeps recent commits in `database.sqlite-wal` next to the file, which is why `database/.gitignore` ignores `*.sqlite*`.
- Case sensitivity: SQLite compares `TEXT` with the binary collation, where MySQL's default collation was case-insensitive. Names are therefore unique per user only when they match exactly — `Cash` and `cash` are two different accounts or watch lists — and a sign-in attempt must type an email's case as stored (registration only accepts lowercase, so stored emails are lowercase). This is the one semantic difference of the switch and is not worked around in code.
- The rest of the schema is ordinary Laravel: UUIDv7 keys are stored as `TEXT`, money as integer cents, timestamps as `datetime`. No query in `app/` uses engine-specific SQL.

## Entities
As built (migrations in `laravel/database/migrations`).
| Entity | Purpose | Owner | Retention |
| --- | --- | --- | --- |
| User | Account identity/auth | System | Indefinite; deleting a user cascades every row below |
| PomodoroPreset | Saved timer preset: durations, the long-break cycle, auto-start, tag, sounds, strict mode | User | Indefinite |
| PomodoroSession | One finished (or abandoned) focus/break interval, logged by whichever client watched it end | User | Indefinite. **Reverses the earlier "no session history" decision** — see the note under Schema |
| Note | CRUD notes; may be starred to pin it to the home page | User | Indefinite |
| BudgetAccount | One of a user's wallets: kind, opening balance, archived flag | User | Indefinite |
| BudgetTransaction | An immutable ledger entry (deposit/withdrawal/transfer leg, with the business date, merchant and category) | User | Indefinite; no update path |
| BudgetCategory | A per-user spending/income bucket, seeded on first use | User | Indefinite |
| BudgetLimit | One monthly cap for one category, period `YYYY-MM` | User | Indefinite |
| BudgetGoal | A virtual savings jar (target, saved, optional source account, target date) | User | Indefinite |
| BudgetReceipt | A transaction's receipt image: disk, path, mime, size | User | Indefinite; deleted with its transaction |
| WorkoutEntry | A one-line logged workout; still the quick path and still what the hourly nudge reads | User | Indefinite |
| Exercise | A library exercise: catalog (unowned) or the user's own | **User or nobody** — the one table here with unowned rows | Indefinite |
| WorkoutRoutine / WorkoutRoutineItem | A saved workout template and its ordered exercises with targets | User (the item through its routine) | Indefinite |
| WorkoutSession | One tracked workout, open while it runs | User | Indefinite |
| WorkoutSet | A single logged set — the table personal records and volume are read from | User | Indefinite |
| BodyMetric | A day's weight, body fat and tape measurements | User | Indefinite — **unresolved**, health data with no limit; see SECURITY.md |
| ProgressPhoto | A private photo's record; the image lives on the private disk | User | Indefinite — **unresolved**, as above, and the only user data outside the database |
| ClipboardItem | A saved snippet | User | Indefinite — **unresolved**, short retention is likely warranted given snippets may hold passwords |
| HistoryEntry | A visited URL | User | Deleted by `history:prune` past the retention window — currently a **placeholder** 90 days, not an approved rule |

## Schema
As built. Every table: `id` UUIDv7 primary key, `user_id` → `users.id` with `cascadeOnDelete`, plus `timestamps()`.
- `pomodoro_presets`: name (60), focus_minutes (uint16), break_minutes (uint16, default 5), long_break_minutes (uint16, default 15), cycles_before_long_break (uint8, default 4), auto_start_breaks (bool, default true), auto_start_focus (bool, default false), tag (40, nullable), alarm_sound / ticking_sound / ambience (20 each, validated against `App\Enums\PomodoroSound` / `PomodoroTicking` / `PomodoroAmbience`), strict_mode (bool, default false), blocked_sites (json, nullable — host patterns the browser add-on blocks), is_default (bool). Index `(user_id, created_at)`. Every column added for issue #3 has a default reproducing the pre-issue behaviour, so the four-field payload older clients send still validates.
- `pomodoro_sessions`: pomodoro_preset_id → pomodoro_presets (**nullOnDelete**), preset_name (60), tag (40, nullable), phase (20: `focus`/`short_break`/`long_break`), started_at, ended_at, duration_seconds (uint), completed (bool — false when the interval was stopped or skipped early), source (20, nullable: `web`/`android`/`extension`). Indexes `(user_id, started_at)` and `(user_id, phase, started_at)`.

  **On the reversed decision.** Earlier drafts of this file and of ARCHITECTURE.md stated that no Pomodoro session history is stored. Issue #3's daily and weekly analytics need one, so that is no longer true — but only half of it changed. A *running* timer is still never persisted anywhere; it lives as long as the client that owns it. Only an interval that has already ended is written, once, by whichever client saw it end, which is why rows carry a `source`. `preset_name` is denormalised deliberately: deleting a preset must not rewrite history, so the row keeps the name it ran under while the foreign key goes null.
- `notes`: title (255), body (text, nullable), is_starred (bool, default false — a starred note is pinned to the home page, and only starred ones appear there). Indexes `(user_id, created_at)` and `(user_id, is_starred, created_at)`, the second serving the home page's filtered read.
- `budget_accounts`: name (60). **Unique `(user_id, name)`** so one user cannot have two accounts of the same name; `kind` (20: `cash`/`bank`/`credit`/`savings`, default `cash`) labels the source, `opening_balance_cents` (uint64, default 0) is the only balance stored, and `archived_at` (nullable) retires an account without deleting its transactions. Index `(user_id, created_at)`, plus `(user_id, archived_at)`. The opening balance is a starting figure, not a running one — the ledger derives the current balance.
- `budget_transactions`: account_id → budget_accounts (cascade), type (20: `deposit`/`withdrawal`/`transfer_in`/`transfer_out`), amount_cents (uint64), related_account_id → budget_accounts (nullable, **nullOnDelete** so a past transfer survives deletion of the counterpart account), transfer_group_id (uuid, nullable — links the two legs of one transfer), description (255, nullable), occurred_on (date, nullable — backfilled from `created_at` for existing rows, which is the only date the ledger had before), merchant (120, nullable), category_id (uuid, nullable → budget_categories, **nullOnDelete** — a deleted category leaves its transactions uncategorized rather than destroying the money spent under it). Indexes `(user_id, created_at)`, `(account_id, created_at)`, `transfer_group_id`, plus `(user_id, occurred_on)` and `(category_id, occurred_on)`.
- `budget_categories`: id (uuid), user_id → users (cascade), name (40), kind (10: `expense`/`income`, default `expense`), timestamps; unique `(user_id, name)`, index `(user_id, kind)`. Seeded with the first five examples on first use.

### Personal finance (issue #5)

- `budget_limits`: id (uuid), user_id, category_id → budget_categories (cascade), period (7: `YYYY-MM`), limit_cents (uint64), timestamps; unique `(user_id, category_id, period)` — one cap per category per month, raising edits the row — and index `(user_id, period)`.
- `budget_goals`: id (uuid), user_id, name (60), target_cents, saved_cents (uint64, default 0 — a running total the user keeps up to date, not a bank balance), account_id → budget_accounts (nullable, **nullOnDelete** — naming an account is optional and only says where the money is meant to come from), target_date (date, nullable), archived_at (timestamp, nullable), timestamps; index `(user_id, archived_at)`.
- `budget_receipts`: id (uuid), user_id, transaction_id → budget_transactions (cascade, unique — one receipt per transaction), disk (20), path, mime (80), size_bytes (uint, default 0), timestamps; index `(user_id)`. The file lives on the **private** disk and is deleted with the row (`BudgetReceiptStorage`, the same rules as progress photos).

- `workout_entries`: activity (100), logged_at (timestamp), notes (text, nullable). Index `(user_id, logged_at)` — serves both the list and the hourly due-check. **Untouched by issue #4**: the tracked tables below sit beside it rather than replacing it, because the quick "I did a thing" log and the home page's popup still want exactly this shape.

### Fitness tracking (issue #4)

Every measure below is an **integer** — grams, metres, seconds, permille,
millimetres — the same call this project already makes with cents. Nothing
stores a float, and kilograms exist only at the point of display.

- `exercises`: **`user_id` nullable** — null is a seeded catalog row — name (120), slug (140), category (20: `strength`/`cardio`/`flexibility`/`mobility`), primary_muscle (60, nullable), equipment (60, nullable), metric (20: `weight_reps`/`reps_only`/`distance_duration`/`duration`), instructions (text, nullable), cues (json, nullable). Unique `(user_id, slug)`, index `(user_id, category)`.

  **The one exception to "every row has an owner".** A catalog exercise belongs to nobody, is readable by everybody and is editable by no one; `ExercisePolicy` splits `view` from `update` to enforce that, and `Exercise::scopeVisibleTo()` is the query-side half. Note the unique index does *not* constrain the catalog, because two NULLs are distinct in SQLite and MySQL alike — `ExerciseLibrarySeeder` keys on the slug itself so re-seeding updates rather than duplicates. There is no image or video column and there should not be one: instructions and cues are text, for the same reason the Pomodoro sounds are synthesised rather than sampled.
- `workout_routines`: name (80), notes (text, nullable). Index `(user_id, created_at)`.
- `workout_routine_items`: workout_routine_id → workout_routines (cascade), exercise_id → exercises (**restrictOnDelete**), position (uint16), target_sets / target_reps (uint16, nullable), target_weight_grams / target_distance_metres / target_duration_seconds (uint, nullable), rest_seconds (uint16, nullable). Index `(workout_routine_id, position)`. **No `user_id`**: the row is only ever reached through its routine, which is what a policy guards. Which targets mean anything depends on the exercise's `metric`; the rest stay null.
- `workout_sessions`: workout_routine_id → workout_routines (**nullOnDelete**), routine_name (80, nullable), started_at, finished_at (nullable — null means in progress), notes (text, nullable). Index `(user_id, started_at)`. `routine_name` is denormalised for the same reason `pomodoro_sessions.preset_name` is: deleting or renaming a routine must not rewrite history. Unlike a Pomodoro interval, this row is written at the *start* — the sets have to attach to something while the workout is still happening. The rest countdown between sets is still never persisted anywhere, on any surface.
- `workout_sets`: workout_session_id → workout_sessions (cascade), exercise_id → exercises (**restrictOnDelete**), position (uint16), is_warmup (bool, default false), reps (uint16, nullable), weight_grams / distance_metres / duration_seconds (uint, nullable), rpe (uint8, nullable), completed_at (timestamp). Indexes `(user_id, exercise_id, completed_at)` and `(workout_session_id, position)`. It carries `user_id` directly even though it could be reached through its session, so every ownership scope is one hop — the same call `budget_transactions` makes. **The first index is the feature**: it is what makes "what did I lift last time" and "is this a personal record" cheap enough to run mid-workout. A warm-up set is logged but never counts towards a record or towards volume.
- `body_metrics`: measured_on (date), weight_grams (uint, nullable), body_fat_permille (uint16, nullable — 17.5% is 175, so nothing rounds), measurements (json, nullable: chest/waist/hips/arm/thigh/calf/neck in millimetres), notes (text, nullable). **Unique `(user_id, measured_on)`** — one reading a day, so logging again replaces it rather than giving the charts two points to plot.
- `progress_photos`: body_metric_id → body_metrics (**nullOnDelete** — deleting a weigh-in must not silently destroy the photo taken that day), disk (20), path, mime (60), size_bytes (uint), taken_on (date), caption (120, nullable). Index `(user_id, taken_on)`. The file itself lives on the **private** disk and is reachable only through an authorizing controller action; `disk` is stored beside `path` so moving to S3 later does not orphan existing rows. See SECURITY.md "Uploads".

**On the two restrictive foreign keys.** `exercise_id` is `restrictOnDelete` in both tables on purpose: cascading would quietly empty somebody's routine or erase logged training history when an exercise is removed. The controllers check for references first and refuse with a readable 422, so the constraint is a backstop rather than the error the user sees.
- `clipboard_items`: title (100, nullable), content (text), source_device (30, nullable — written only by future Android/add-on clients). Index `(user_id, created_at)`.
- `history_entries`: url (2048), title (255, nullable), visited_at (timestamp), source (20, nullable: `manual`/`seed`/future `extension`). Indexes `(user_id, visited_at)`, `visited_at`. **No `deleted_at`** — a soft delete would defeat the point of the prune job, so deletions are real.

No `currency` column anywhere: ZAR is fixed app-wide. Money is stored only as integer cents and formatted client-side (`resources/js/Lib/formatZar.js`), so no float arithmetic touches money.

## Relationships
- `User` has many of every other entity above (1-to-many), via explicit relation methods on the `User` model. `BudgetCategory` has many `BudgetLimit` rows and many `BudgetTransaction` rows, both scoped to the owner.
- `BudgetAccount` has many `BudgetTransaction` (`account_id`). `BudgetGoal` optionally names an `BudgetAccount` as its source, without owning the row.
- `WorkoutRoutine` has many `WorkoutRoutineItem` (ordered by `position`); `WorkoutSession` has many `WorkoutSet`; `BodyMetric` has many `ProgressPhoto`.
- Delete behavior (built): module FKs are `cascadeOnDelete` by default — deleting a user removes all their data, and deleting a budget account, a routine or a workout removes its children. The exceptions, each for a stated reason:
  - `budget_transactions.related_account_id` — `nullOnDelete`, so the surviving account keeps its side of a past transfer.
  - `workout_sessions.workout_routine_id` — `nullOnDelete`; the workout happened, and deleting the template must not erase it.
  - `progress_photos.body_metric_id` — `nullOnDelete`; deleting a weigh-in must not silently destroy a photo.
  - `workout_routine_items.exercise_id` and `workout_sets.exercise_id` — **`restrictOnDelete`**; see the note under Schema.
- Deleting a `ProgressPhoto` row also deletes its file (`ProgressPhoto::deleteWithFile()`). That is application-level, not a database guarantee: a row removed by a raw cascade would leave the image behind.

## Access rules
- Only the owning user can read/create/update/delete their records. There is no cross-user access path at all, since the owner confirmed strict multi-tenancy.
- Enforcement (built, three layers):
  1. Controllers query **through the user relation** (`$request->user()->notes()`), never `Model::where('user_id', …)` with a client-supplied id.
  2. A policy per model compares `$model->user_id === $user->getKey()`; policies are registered explicitly in `AuthServiceProvider::POLICIES`, and there is deliberately no `Gate::before()` admin bypass.
  3. FormRequests that reference another of the user's records use `Rule::exists(...)->where('user_id', …)`, so a foreign id fails validation.
- A bound-but-foreign record aborts **404, not 403** (`AuthorizesOwnership`), so existence is not confirmed to a non-owner.
- Transactions and history entries have no `update` ability at all (immutable records).
- **The exercise library is the one place these rules bend, and only in one direction.** A catalog row (`user_id` null) passes `view` for everybody and `update`/`delete` for nobody, so the shared library cannot be edited out from under other users. A user's own exercise behaves like every other record here. There is no case in which one user reaches another user's exercise. Any request naming an `exercise_id` — a routine item, a logged set — validates it with a `Rule::exists` scoped to "mine or unowned", never an open one.
- Whether an admin/operator role exists: **unresolved** — open decision in PRD.md. Nothing in the code grants one.
- Budget scoping follows the same three layers for every new entity the issue added: `BudgetCategory`, `BudgetLimit`, `BudgetGoal` and `BudgetReceipt` are reached through the owning user's relation, guarded by their policies, with any cross-record reference (`category_id`) validated with an ownership-scoped `Rule::exists`. A bound-but-foreign record aborts **404**, never 403. Receipt files are reachable only through the receipt route that authorizes the owner, and the image bytes never ride inside a JSON response.

## Queries and indexes
- Every per-user list query filters on `user_id` and orders by recency, matched by the composite indexes listed in Schema above.
- Budget balances are **derived**, never stored: `BudgetService::balancesFor()` computes every one of a user's account balances in a single grouped query (so listing N accounts is not N queries); `BudgetAccount::balanceCents()` serves single-account use. Nothing can drift out of sync with the ledger.

## Migrations and seed data
- Laravel migrations. Review process: **unresolved**.
- Seed data: `DemoDataSeeder`, called from `DatabaseSeeder` only when `app()->environment('local')`. Entirely synthetic, and includes a deliberately stale history row so `history:prune` can be exercised. Production seeding is intentionally empty.
- Rollback/backups/restore check: **unresolved**.

## Data validation
Built, at the request boundary (`laravel/app/Http/Requests`): required fields and length caps per module; amounts `numeric|min:0.01`; a withdrawal or transfer that exceeds the source account's derived balance is rejected with a field error; a transfer's two accounts must differ; account names unique per user; for issue #5, a transaction's `occurred_on` is a nullable date not after today, `merchant` is nullable text up to 120, and `category_id` is a nullable UUID scoped to the caller's categories that must accept the transaction's type (an income bucket cannot hold a withdrawal). `BudgetService` independently throws `InsufficientFundsException` so the rule holds even if a caller bypasses the FormRequest. Remaining open items (clipboard retention/encryption, real history rule) are listed in PRD.md.
