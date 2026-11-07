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
| Android | Kotlin + Jetpack Compose, Material 3 (built) | Owner's explicit choice. Conventions and the pinned dependency set come from the sibling Laravel+Kotlin client at `C:\Users\Teddy\projects\giwubible\kotlin` | AGP 9.2.1 / Kotlin 2.2.21 / Compose BOM 2025.09.01; **minSdk 26** (vs. giwubible's 21) so notification channels need no version guard; raw OkHttp 4.12 + kotlinx.serialization, **no Retrofit**; hand-assembled `AppContainer`, **no Hilt/Koin**; WorkManager 2.10.1 for the hourly reminder |
| Browser add-ons | Manifest V3 WebExtension, plain ES modules, **no build step** (built) | Chrome + Firefox from `docs/init.txt`. No bundler because it loads unpacked as-is and stays auditable, which matters for an extension that can read browsing history | Chrome uses `background.service_worker`, Firefox `background.scripts`; the manifest carries both and each browser ignores the other's key. Firefox needs `browser_specific_settings.gecko.id` |

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

android/                 Kotlin/Compose client (five modules; no History)
  app/src/main/java/com/jackandthings/
    AppContainer.kt      hand-assembled object graph
    MainActivity.kt      reads ACTION_SEND shared text
    data/                AppPrefs, TokenStore (EncryptedSharedPreferences)
    data/remote/         ApiClient (OkHttp), JackApi (one method per endpoint)
    model/Models.kt      @Serializable wire models
    repo/                AuthStore + one repository per module, all Result<T>
    ui/<module>/         Screen + ViewModel pairs, plus common/ and theme/
    work/                WorkoutReminders: channel, scheduling, worker
  gradle/libs.versions.toml   pinned version catalog

extension/               MV3 add-on (five modules + the history add-on)
  manifest.json          cross-browser; history is an OPTIONAL permission
  icons/                 generated PNGs (Chrome will not take SVG here)
  src/lib/               ext.js (namespace + settings), api.js, dom.js, format.js
  src/background/        service-worker.js: alarms for reminder, prune, timer
  src/popup/             popup shell + views/<module>.js
  src/options/           sign-in, server URL, preferences
```

## Operations
- Local development: Herd (PHP 8.4 + bundled MySQL). `php artisan serve` + `npm run dev`, or `composer run dev` for the concurrent server/queue/log/vite setup.
- Loading the add-on: Chrome — `chrome://extensions`, enable Developer mode, "Load unpacked", pick `extension/`. Firefox — `about:debugging#/runtime/this-firefox`, "Load Temporary Add-on", pick `extension/manifest.json`. Then open its options page and sign in. Note Chrome 156 refuses the `--load-extension` command-line switch, so loading it from the UI is the only route.
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

**Built (Android):**
- Kotlin/Compose client for Pomodoro, Notes, Budget, Workout and Clipboard, consuming `api/v1` with Sanctum bearer tokens. History is deliberately excluded — it is browser history, which `docs/init.txt` assigns to the add-ons and the web app.
- The app reaches a local server at `http://10.0.2.2:8000/api/v1/` by default (the emulator's route to the host), and the address is editable in Settings so a LAN or deployed host needs no rebuild. Note Herd serves the web app at `http://jackandthings.test`, which the emulator cannot resolve — hence `php artisan serve` for device testing.

**Built (browser add-on):**
- One Manifest V3 extension carrying Pomodoro, Notes, Budget, Workout and Clipboard, plus the history add-on `docs/init.txt` describes separately. Keeping it as one extension matches the "merge these into one app" intent; `history` being an *optional* permission keeps the privacy cost off anyone who only wants the notes.
- It is the first thing that actually populates `history-entries`: recording mirrors visits to the server, and auto-delete clears browser history past the server's retention window. Both are separate opt-ins and both need the optional permission.
- Cross-origin calls work without server changes — Laravel's `HandleCors` is already in the default stack and answers the preflight on `api/*`. The extension still needs the API host in `host_permissions`, which it requests at runtime for whatever address is configured.

**Still unresolved:**
- The real history auto-delete rule (schedule, which browsers/profiles, per-domain exceptions) — the 90-day default is a placeholder.
- Notification delivery for workout reminders **beyond Android**. The Android app now polls `workout-entries/due` hourly via WorkManager and raises its own local notification, which is what the server's poll-only design intended; the web app still shows an in-page banner only, and nothing is pushed from the server.
- Clipboard cross-device sync semantics (conflict handling, retention, whether content should be encrypted at rest given it may hold passwords).
- Whether an admin/operator role exists.
- Whether the add-on should be packaged and signed for distribution. It is load-unpacked only today, and Firefox treats an unsigned one as temporary, so it disappears on restart.
- Environment separation from `fiyobra`'s production hosting; deployment, rollback, monitoring.
- Email verification is scaffolded but not enforced (`User` does not implement `MustVerifyEmail`), so the `verified` middleware currently passes through.
