# Architecture

## System purpose
A multi-tenant personal suite with three client surfaces — a Laravel web app, a native Kotlin Android app, and Chrome/Firefox browser add-ons — sharing six modules (Pomodoro, Notes, Budget, Workout, Clipboard, History) through one backend. Each user's data is private to their own account. See `docs/PRD.md` for confirmed scope and open questions.

## Stack decisions
Versions below are what is actually installed in `laravel/` (from `composer.lock` / `package.json`), not proposals.

| Layer | Selected technology | Reason | Constraints |
| --- | --- | --- | --- |
| Frontend (web) | Inertia + React 18, Tailwind CSS (built) | Matches the sibling project `fiyobra/laravel`; Tailwind is the Breeze React default and pairs with DESIGN_SYSTEM.md's CSS-custom-property tokens | `@inertiajs/react` ^2.0, `inertiajs/inertia-laravel` v3.7.0 (newer major than fiyobra's v2 — verified working with Breeze 2.4 scaffolding) |
| Backend/API | Laravel v13.40.0 on PHP 8.4.20 (built) | Owner chose "like fiyobra" | Local PHP is 8.4 via Herd; `composer.json` requires `^8.3` |
| Database | MySQL 8.0.46 (confirmed and running) | Matches fiyobra's `DB_CONNECTION=mysql`; owner approved locking in the proposal | Local instance is Herd's bundled service on `127.0.0.1:3306`; database `jackandthings` |
| Authentication | Laravel Breeze (session) + Sanctum v4.3.3 tokens, email+password (built) | Owner's explicit choice. Breeze used instead of hand-rolling (fiyobra hand-rolled only for column-encryption/2FA/multi-domain needs that do not apply here) | Web uses the session guard; Android/add-ons use bearer tokens from `POST /api/v1/auth/token` |
| Route helper | Ziggy v2.6.5 | Breeze's React stack calls `route()` in JS, same as fiyobra | — |
| Hosting | Existing server already hosting `fiyobra` (confirmed) | Owner's explicit choice | Specific provisioning, domain, and environment separation from `fiyobra`'s production environment — **unresolved** |
| Android | Kotlin (confirmed, from `docs/init.txt`) | Owner's explicit choice | Not started. Architecture pattern (MVVM/Compose vs. XML views), min SDK, networking library — **unresolved** |
| Browser add-ons | Chrome + Firefox (confirmed, from `docs/init.txt`) | Owner's explicit choice | Not started. Manifest version (proposal: Manifest V3 WebExtensions), build tooling — **unresolved** |

## System boundaries
- Client owns (as built): presentation and local UX state only. The Pomodoro countdown is the one piece of real client-side logic and is deliberately ephemeral — nothing about a running timer is persisted.
- Server owns (as built): all validation (FormRequests), authorization (policies), per-user data isolation, and business rules (budget math and transfer atomicity in `BudgetService`, reminder state in `WorkoutReminderStatus`, history deletion in `history:prune`).
- External services own: none. No third-party service is used — notification delivery is deliberately not built (see PRD.md).
- Out of scope: anything not in the six confirmed modules (PRD.md MVP scope).

## Request and data flow
As built:
1. A client authenticates — the web app via the Breeze session guard, Android/add-ons via a Sanctum bearer token from `POST /api/v1/auth/token`.
2. The request hits a FormRequest that validates input; any field referencing another of the user's records (e.g. a transfer's `to_account_id`) uses an ownership-scoped `Rule::exists`.
3. The controller reads/writes **through the user relation** (`$request->user()->notes()`), never `Model::where('user_id', …)`.
4. For a route-bound record, a policy checks `user_id === auth user`; a failure aborts **404, not 403**, so existence is never confirmed to a non-owner.
5. The response updates the UI (Inertia) or returns JSON (API). Verified: cross-tenant reads and writes return 404 on all nine web routes and five API routes tested, and a DB audit found zero cross-owner rows.

## Interfaces
- API contract: **built** — 37 registered `api/v1/*` routes. Token: `POST /api/v1/auth/token` (throttled 6/min), `GET /api/v1/auth/me`, `DELETE /api/v1/auth/token`. Resources: `notes`, `pomodoro-presets`, `clipboard-items`, `workout-entries` (+ `GET workout-entries/due`), `history-entries` (no update), `budget-accounts`, `budget-transactions` (index/store/destroy), `POST budget-transfers`. All behind `auth:sanctum` + `throttle:60,1`.
- Events/jobs: `history:prune` is scheduled daily in `routes/console.php`. No queue work yet. Workout reminders have **no** scheduled job or delivery mechanism by design — clients poll `workout-entries/due` and raise their own notification.

## Project structure
The Laravel app lives in the `laravel/` subdirectory (mirroring `fiyobra/laravel`), leaving room for the Android and browser-extension codebases as siblings later.

```
laravel/
  app/
    Console/Commands/PruneHistoryEntries.php
    Enums/BudgetTransactionType.php
    Exceptions/InsufficientFundsException.php
    Http/Controllers/
      Auth/            Breeze-generated session auth
      Web/             10 session-guard controllers (one area per module)
      Api/V1/          9 token-guard controllers (incl. AuthController)
      Concerns/AuthorizesOwnership.php   the 404-not-403 ownership check
    Http/Requests/     9 FormRequests
    Models/            User + 7 module models (UUID keys via HasUuids)
    Policies/          7 policies, registered explicitly
    Providers/AuthServiceProvider.php
    Services/          BudgetService, WorkoutReminderStatus
  config/history.php   retention placeholder
  database/migrations  7 module tables + Laravel/Sanctum defaults
  database/factories   7 factories;  seeders/DemoDataSeeder.php (local only)
  resources/js/
    Components/        Breeze components + Pagination, EmptyState, PageShell
    Layouts/           AuthenticatedLayout (six-module nav)
    Lib/formatZar.js
    Pages/             Dashboard hub + Pomodoro, Notes, Budget, Workout, Clipboard, History
  routes/web.php, api.php, console.php, auth.php
```

## Operations
- Local development: Herd (PHP 8.4 + bundled MySQL). `php artisan serve` + `npm run dev`, or `composer run dev` for the concurrent server/queue/log/vite setup.
- Environments, configuration, deployment, rollback: **unresolved**. Flagging a risk again: sharing infrastructure with `fiyobra`'s production environment means environment separation (so a jackandthings bug/outage can't affect fiyobra, and vice versa) needs an explicit decision before any deployment. Nothing has been deployed.
- Logs, monitoring, scale limits: **unresolved**. `fiyobra` uses `sentry/sentry-laravel`; not installed here. Laravel's default `stack`/`single` log channel only.

## Decisions and unknowns
**Confirmed and built (web + API):**
- Multi-tenant, per-user account isolation — enforced by relation-scoped queries, explicit policies, and 404-on-foreign-record.
- All six modules, as both Inertia web pages and a versioned token API.
- Laravel 13 + Inertia + React + Tailwind, Breeze auth scaffolding, MySQL, Sanctum tokens.
- Budget: multiple accounts per user, fixed ZAR, integer-cent storage, derived balances, atomic two-leg transfers, overdraft rejection.
- History: hard-delete model plus a daily `history:prune` with a clearly-marked placeholder retention window.
- Workout: reminder *state* only, polled via API; no delivery.

**Confirmed but not started (later passes):**
- Kotlin Android app; Chrome/Firefox add-ons. Both will consume the `api/v1` contract above.

**Still unresolved:**
- The real history auto-delete rule (schedule, which browsers/profiles, per-domain exceptions) — the 90-day default is a placeholder.
- Notification delivery mechanism for workout reminders.
- Clipboard cross-device sync semantics (conflict handling, retention, whether content should be encrypted at rest given it may hold passwords).
- Whether an admin/operator role exists.
- Android architecture pattern and min SDK; add-on manifest version and build tooling.
- Environment separation from `fiyobra`'s production hosting; deployment, rollback, monitoring.
- Email verification is scaffolded but not enforced (`User` does not implement `MustVerifyEmail`), so the `verified` middleware currently passes through.
