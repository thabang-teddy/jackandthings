# Database

## Storage model
- Database/provider: **MySQL 8.0** (confirmed and built). Database `jackandthings`, dedicated `jackandthings` user. Local instance is Herd's bundled MySQL on `127.0.0.1:3306`.
- Ownership model: Multi-tenant — each row is owned by exactly one user account; no shared/family ownership (confirmed via owner's answer: "Multi-tenant, separate accounts per user").
- Key types: `users.id` stays Laravel's `bigIncrements` (so Breeze's `sessions` table and Sanctum's `tokenable` morphs work unchanged). **All seven module tables use UUIDv7 primary keys** (`HasUuids`) so record ids in URLs and API responses are not enumerable; their `user_id` is a `foreignId` to `users`.
- Data classification:
  - Sensitive: Budget accounts/transactions (financial), Clipboard contents (may contain passwords or other sensitive text), auth credentials.
  - Personal: Notes, Workout entries, History/URLs.
  - Internal: Pomodoro presets/sessions.

## Entities
As built (migrations in `laravel/database/migrations`).
| Entity | Purpose | Owner | Retention |
| --- | --- | --- | --- |
| User | Account identity/auth | System | Indefinite; deleting a user cascades every row below |
| PomodoroPreset | Saved timer preset | User | Indefinite. No session/run history is stored — a running timer is ephemeral client state |
| Note | CRUD notes | User | Indefinite |
| BudgetAccount | One of a user's accounts/wallets | User | Indefinite |
| BudgetTransaction | An immutable ledger entry (deposit/withdrawal/transfer leg) | User | Indefinite; no update path |
| WorkoutEntry | A logged workout | User | Indefinite |
| ClipboardItem | A saved snippet | User | Indefinite — **unresolved**, short retention is likely warranted given snippets may hold passwords |
| HistoryEntry | A visited URL | User | Deleted by `history:prune` past the retention window — currently a **placeholder** 90 days, not an approved rule |

## Schema
As built. Every table: `id` UUIDv7 primary key, `user_id` → `users.id` with `cascadeOnDelete`, plus `timestamps()`.
- `pomodoro_presets`: name (60), focus_minutes (uint16), break_minutes (uint16). Index `(user_id, created_at)`.
- `notes`: title (255), body (text, nullable). Index `(user_id, created_at)`.
- `budget_accounts`: name (60). **Unique `(user_id, name)`** so one user cannot have two accounts of the same name. Index `(user_id, created_at)`.
- `budget_transactions`: account_id → budget_accounts (cascade), type (20: `deposit`/`withdrawal`/`transfer_in`/`transfer_out`), amount_cents (uint64), related_account_id → budget_accounts (nullable, **nullOnDelete** so a past transfer survives deletion of the counterpart account), transfer_group_id (uuid, nullable — links the two legs of one transfer), description (255, nullable). Indexes `(user_id, created_at)`, `(account_id, created_at)`, `transfer_group_id`.
- `workout_entries`: activity (100), logged_at (timestamp), notes (text, nullable). Index `(user_id, logged_at)` — serves both the list and the hourly due-check.
- `clipboard_items`: title (100, nullable), content (text), source_device (30, nullable — written only by future Android/add-on clients). Index `(user_id, created_at)`.
- `history_entries`: url (2048), title (255, nullable), visited_at (timestamp), source (20, nullable: `manual`/`seed`/future `extension`). Indexes `(user_id, visited_at)`, `visited_at`. **No `deleted_at`** — a soft delete would defeat the point of the prune job, so deletions are real.

No `currency` column anywhere: ZAR is fixed app-wide. Money is stored only as integer cents and formatted client-side (`resources/js/Lib/formatZar.js`), so no float arithmetic touches money.

## Relationships
- `User` has many of every other entity above (1-to-many), via explicit relation methods on the `User` model.
- `BudgetAccount` has many `BudgetTransaction` (`account_id`).
- Delete behavior (built): every module FK is `cascadeOnDelete` — deleting a user removes all their data, and deleting a budget account removes its transactions. The single exception is `budget_transactions.related_account_id`, which is `nullOnDelete` so the surviving account keeps its side of a past transfer.

## Access rules
- Only the owning user can read/create/update/delete their records. There is no cross-user access path at all, since the owner confirmed strict multi-tenancy.
- Enforcement (built, three layers):
  1. Controllers query **through the user relation** (`$request->user()->notes()`), never `Model::where('user_id', …)` with a client-supplied id.
  2. A policy per model compares `$model->user_id === $user->getKey()`; policies are registered explicitly in `AuthServiceProvider::POLICIES`, and there is deliberately no `Gate::before()` admin bypass.
  3. FormRequests that reference another of the user's records use `Rule::exists(...)->where('user_id', …)`, so a foreign id fails validation.
- A bound-but-foreign record aborts **404, not 403** (`AuthorizesOwnership`), so existence is not confirmed to a non-owner.
- Transactions and history entries have no `update` ability at all (immutable records).
- Whether an admin/operator role exists: **unresolved** — open decision in PRD.md. Nothing in the code grants one.

## Queries and indexes
- Every per-user list query filters on `user_id` and orders by recency, matched by the composite indexes listed in Schema above.
- Budget balances are **derived**, never stored: `BudgetService::balancesFor()` computes every one of a user's account balances in a single grouped query (so listing N accounts is not N queries); `BudgetAccount::balanceCents()` serves single-account use. Nothing can drift out of sync with the ledger.

## Migrations and seed data
- Laravel migrations. Review process: **unresolved**.
- Seed data: `DemoDataSeeder`, called from `DatabaseSeeder` only when `app()->environment('local')`. Entirely synthetic, and includes a deliberately stale history row so `history:prune` can be exercised. Production seeding is intentionally empty.
- Rollback/backups/restore check: **unresolved**.

## Data validation
Built, at the request boundary (`laravel/app/Http/Requests`): required fields and length caps per module; amounts `numeric|min:0.01`; a withdrawal or transfer that exceeds the source account's derived balance is rejected with a field error; a transfer's two accounts must differ; account names unique per user. `BudgetService` independently throws `InsufficientFundsException` so the rule holds even if a caller bypasses the FormRequest. Remaining open items (clipboard retention/encryption, real history rule) are listed in PRD.md.
