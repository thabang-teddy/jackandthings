# Product Requirements Document

## Project context
- Product: Jack & Things *(working title, inferred from the repository name `jackandthings` — rename if you have a real product name)*
- Owner: Thabang Teddy Morwasetla
- Status: Draft
- Problem: Personal productivity, finance, health, and browsing tools are spread across separate apps. The user wants one integrated suite instead.
- Target users: Individual account holders. Each user has their own private account and data (multi-tenant, confirmed) — this is not a shared/family login.
- Desired outcome: One cross-platform suite — a Laravel web server, a Kotlin Android app, and Chrome/Firefox browser add-ons — all sharing the same six modules and backend data.

## MVP scope
- Must ship (confirmed): all six modules below, across all three platforms (server, Android, browser add-ons) **in parallel**, per the owner's explicit choice.
  - Pomodoro — start a timer, select a group/preset.
  - Notes — CRUD.
  - Budget — multiple accounts/wallets per user; dashboard, add transaction, transfer between accounts.
  - Workout — log workouts done throughout the day; hourly reminders.
  - Clipboard — share clipboard content between apps/devices on the same account.
  - History — list browsing history, plus an add-on that automatically deletes URL history, managed from the Laravel server.
- Explicitly excluded: **unresolved** — nothing has been deferred yet. Building all six modules on all three platforms simultaneously, with no sequencing, is a large surface area for a first release; flagging this as a risk rather than quietly narrowing scope myself.
- Constraints:
  - Must deploy alongside/on the same infrastructure already hosting the sibling project at `C:\Users\Teddy\projects\fiyobra\laravel` (confirmed).
  - Web stack follows that project's pattern: Laravel + Inertia + React (confirmed).
  - Android app is Kotlin (confirmed, from `docs/init.txt`).
  - Browser add-ons target Chrome and Firefox (confirmed, from `docs/init.txt`).
  - Budget, timeline: **unresolved**.

## User journeys
Drafted from `docs/init.txt`; step-level detail is a **proposal** pending your approval, not confirmed.
1. A user starts a Pomodoro session, selects a saved preset/group, and the timer runs to completion or is cancelled.
2. A user opens Budget, adds a transaction against one of their accounts, and sees the dashboard balance update. Failure path (e.g. invalid amount): **unresolved**.
3. A user transfers money between two of their own accounts/wallets.
4. A user creates, edits, and deletes a note (CRUD).
5. A user logs a workout entry during the day and receives an hourly reminder. Delivery mechanism for the reminder (push notification, in-app only, etc.): **unresolved**.
6. A user copies something on one device/app and it becomes available to paste in another app/device on the same account. Sync mechanism and security model: **unresolved**.
7. A user views their browsing history list; the History add-on automatically deletes URL history on some schedule. Exact deletion rule/schedule and scope (which browsers, which URLs): **unresolved**.

## Feature specifications
Two passes are done: the Laravel server (web UI + `api/v1`), and the Kotlin Android client. The browser add-ons are not started.

| ID | User need | Behavior | Status | Priority |
| --- | --- | --- | --- | --- |
| F-01 | As a user, I need to run a Pomodoro timer | Save presets (name, focus/break minutes); start one; timer counts focus then rolls into the break | **Built (web + API + Android).** Android gives it the full-screen countdown `init.txt` asked for. Nothing about a running timer is persisted on either client | Must |
| F-02 | As a user, I need to manage notes | Create, read, update, delete notes (title, body) | **Built (web + API + Android)** | Must |
| F-03 | As a user, I need to track a budget | Multiple accounts; deposit/withdraw; transfer between own accounts; dashboard with per-account and total balances | **Built (web + API + Android).** Fixed ZAR, integer cents, derived balances, atomic two-leg transfers, overdrafts rejected. No categories | Must |
| F-04 | As a user, I need to track workouts | Log entries (activity, when, notes); know when an hour has passed without one | **Built on Android; partial on web.** The server reports due-state only and sends nothing; the Android app polls it hourly (WorkManager) and raises a local notification. The web app shows an in-page banner with no notification | Must |
| F-05 | As a user, I need to share clipboard content across apps | Save snippets; copy them back | **Built (web + API + Android).** Android reads/writes the system clipboard and accepts text from the share sheet, stamping `source_device`. Genuinely cross-device once a second client is installed; the add-ons will complete the picture | Must |
| F-06 | As a user, I need to manage browsing history | View history list; auto-delete old URLs | **Partly built, server only.** Model, API, management UI and a daily `history:prune` exist, fed by manual/seeded entries. Deliberately absent from Android. Real ingestion needs the browser add-on, and the retention rule is a placeholder | Must |

## Success measures
- Metric: **unresolved** — no success metrics have been defined yet.
- Accessibility/performance requirements: **unresolved**.

## Open decisions
**Settled since the first draft:** build order (server first, then Android and add-ons), currency (fixed ZAR), stack and auth (Laravel 13 + Inertia/React + MySQL + Breeze/Sanctum), and Budget's multi-account model.

**Still open:**
- Workout reminders on surfaces other than Android. Android is settled: it polls due-state hourly and raises its own local notification, so the server still pushes nothing. Whether the web app should get web push (or nothing) is undecided.
- History auto-delete rule: schedule, which browsers/profiles, per-domain exceptions — needed before F-06 is complete. A 90-day placeholder is in `config/history.php`, clearly marked as not approved.
- Clipboard sensitivity: snippets are stored in plaintext and may contain passwords. Decide on a retention window and/or encryption at rest — see SECURITY.md.
- Sanctum token expiry (currently none) and whether a password change should revoke all tokens.
- Whether an admin/operator role exists alongside regular per-user accounts.
- Whether email verification should be enforced (scaffolded but inactive — `User` does not implement `MustVerifyEmail`).
- Environment separation from `fiyobra`'s hosting, plus deployment/rollback/monitoring — needed before anything ships.
- Success metrics and release criteria (below) remain undefined.
- Add-on manifest version and build tooling — needed before that pass starts.
- Whether the existing Flutter apps `teddoro` (Pomodoro) and `budget-teddy` (Budget) should be retired now that Android covers both, and whether any of their behaviour is missing here. They were rewritten rather than ported, since merging them meant retargeting to this API regardless of language.

## Definition of ready
Partly met. The server-side scope is confirmed, built and manually verified (see TESTING.md). Acceptance criteria were never formally written per feature, three features are only partly complete pending the decisions above, and no automated tests exist yet.
