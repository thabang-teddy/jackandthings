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
  - Pomodoro — start a timer, select a group/preset. Extended by issue #3 into full time-and-focus management: long breaks on a cycle, auto-start, tags, sound, strict mode and analytics.
  - Notes — CRUD.
  - Budget — multiple accounts/wallets per user; dashboard, add transaction, transfer between accounts.
  - Workout — log workouts done throughout the day; hourly reminders. Extended by issue #4 into fitness tracking: an exercise library, routines, set-by-set logging with a rest timer, body metrics and progress photos, and personal records.
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
All three surfaces now exist: the Laravel server (web UI + `api/v1`), the Kotlin Android client, and the Manifest V3 browser add-on.

| ID | User need | Behavior | Status | Priority |
| --- | --- | --- | --- | --- |
| F-01 | As a user, I need to run a Pomodoro timer | Save presets (durations including a long break on a configurable cycle, auto-start choices, a category tag, alarm/ticking/background sound, strict mode); start one; the timer runs the cycle, and each finished interval feeds daily and weekly analytics | **Built on all three surfaces** (issue #3). Android gives it the full-screen countdown `init.txt` asked for. A *running* timer is still not persisted anywhere; a *finished* interval is. Three caveats are stated rather than papered over: the generated audio has never been listened to, strict mode's privileged halves (Android Do Not Disturb, add-on site blocking) have never run, and web strict mode cannot block notifications or lock a screen — it keeps the screen awake and warns before you leave, and says so | Must |
| F-02 | As a user, I need to manage notes | Create, read, update, delete notes (title, body) | **Built (web + API + Android)** | Must |
| F-03 | As a user, I need to track a budget | Multiple accounts/wallets; deposit/withdraw against them; transfer between own accounts; dashboard with per-account and total balances; per-user spending categories, monthly caps and savings goals; spending reports and due-state alerts; receipts attached to a transaction | **Built on all three surfaces (issue #5).** Fixed ZAR, integer cents, derived balances, atomic two-leg transfers, overdrafts rejected; transactions carry `occurred_on`/`merchant`/`category_id`, reports and caps group by the business date; custom categories are per user and seeded on first use; caps are per category per month; goals are virtual jars; receipts follow the progress-photo storage rules. Export is streamed CSV only. | Must |
| F-04 | As a user, I need to track workouts and my fitness | The one-line log (activity, when, notes) and the hourly nudge, plus — since issue #4 — an exercise library, saved routines, set/rep/weight logging against a live workout, a rest timer, previous numbers shown while training, body metrics with private progress photos, and personal records with a consistency calendar | **Built (web + API + Android + add-on).** The server reports reminder due-state only and sends nothing; each client polls it and raises its own local notification. Issue #4's scope limits are deliberate and recorded below: no wearable sync, exercise instructions are text rather than media, and the add-on carries the live-logging half only | Must |
| F-05 | As a user, I need to share clipboard content across apps | Save snippets; copy them back | **Built on all three.** Android reads/writes the system clipboard and accepts share-sheet text; the add-on can paste from and copy to the clipboard. Both stamp `source_device`, so a snippet saved on the phone is one click away in the browser — the cross-device sync `init.txt` asked for | Must |
| F-06 | As a user, I need to manage browsing history | View history list; auto-delete old URLs | **Built (server + add-on).** The add-on records visits to the server and clears browser history past the retention window, both opt-in behind an optional permission; the server keeps the records and runs `history:prune`. Deliberately absent from Android. The retention rule itself is still a placeholder | Must |

## Success measures
- Metric: **unresolved** — no success metrics have been defined yet.
- Accessibility/performance requirements: **unresolved**.

## Open decisions
**Settled since the first draft:** build order (server first, then Android and add-ons), currency (fixed ZAR), stack and auth (Laravel 13 + Inertia/React + SQLite + Breeze/Sanctum), and Budget's multi-account model.

**Settled since:** workout reminders in the *web app*. The page now follows the
same design as the other two clients — it polls due-state (`GET /workouts/due`,
session-guarded) and raises its own desktop notification, so the server still
pushes nothing. Pomodoro phase changes notify the same way. The known limit is
that a page can only notify while one of its tabs is open; delivering to a
closed browser would need Web Push, which means a server that sends, and that
is still ruled out.

**Settled by issue #4:** the Workout module's shape. Seven new tables, six web
pages, five Android destinations. Four calls inside it are worth recording
because they narrowed the issue's own wording, each for a stated reason rather
than for convenience:

- **Wearable and health sync is dropped, not deferred.** The issue asked for
  Apple Health and Google Fit. Apple Health is unreachable — there is no iOS
  surface and none is planned — and Google Fit's APIs are retired in favour of
  Health Connect, which is Android-local and needs a Play declaration. What
  remains reachable is a read-only Health Connect import of steps, heart rate
  and calories on Android alone, which is a different feature from the one the
  issue describes. It is out of scope until somebody asks for that instead.
- **"Form demonstrations" ship as text**, not images or video: written
  instructions plus a cue list, for the same reason the Pomodoro sounds are
  synthesised rather than sampled. Bundling demo media means redistributing
  somebody else's work.
- **Fixed metric units** — kilograms and kilometres, stored as integer grams,
  metres, seconds, permille and millimetres. The same call as Budget's fixed
  ZAR and integer cents. No per-user unit preference.
- **The add-on carries the live-logging half only.** A 400px popup is not
  where anyone plans a training block or types seven tape measurements, so the
  routine builder and body metrics stay on the web app and the phone, and
  progress photos are absent from the add-on entirely.
- **The add-on carries the quick-expense half only for Budget.** The popup
  logs a spend against an account, a category and a business date and shows the
  month's cap meters. Reports, goals and receipts stay on the web app and the
  phone; limits are display-only in the popup.

**Settled by issue #5:** the Budget module's shape, across the web, the API,
the Android app and the add-on. The issue's wording ("personal finance") reached
further than its title, and each pull was settled against the owner's sense of
what a small personal app can honestly ship:

- **Money stays integer cents, fixed ZAR.** Reports group spending by a
  transaction's `occurred_on` (the business date, defaulting to today) and not by
  the write time; `created_at` remains the immutable audit stamp. All three
  clients run the same integer-only rule copies; the server stays the authority.
- **Transactions gained `occurred_on`, `merchant` and `category_id`.** Reports,
  caps and the transaction list read the category and merchant off the row.
  Existing rows are backfilled from the day they were written, which is the only
  date the ledger had before.
- **Categories are per user**, seeded with five examples on first use, renameable
  and extendable, with `(user_id, name)` unique.
- **Caps are per category per month** (`YYYY-MM`), one cap per category per
  month, raised by editing the row; near/over/under come from the shared integer
  rule (near at 80%).
- **Goals are virtual jars**, not bank accounts; saving into one does not move
  money between accounts.
- **Reports** aggregate a month plus trailing months for net worth; the server
  also answers due-state (bills inside the reminder window, caps near or over).
- **Export is a streamed CSV** (the UI labels it Excel-compatible). The `.xlsx`
  route with PhpSpreadsheet was **dropped**: no new dependency and the real
  requirement was "the user can open the file".
- **Receipts** follow the progress-photo rules: private disk, `mimetypes`
  allow-list, server-sniffed file, random stored name, storage fields outside
  `#[Fillable]`, authorized per-read route, file deleted with the row.

Scope decisions, each for a stated reason:

- **The lock feature is dropped**, by decision. Nothing about budgeting becomes
  a task; the module keeps ledger, categories, caps, goals, reports and receipts.
- **Android planning writes and reads are online-only** (categories, limits,
  goals, reports, due, receipts). The ledger itself keeps its local signed-out
  copy and offline queue; limits, reports and due state are not cached, so a
  signed-out month would be fiction.
- **The add-on cannot upload or attach receipts**, and never plans: quick expense
  logging plus month limit state only.

**Settled by issue #3:** whether Pomodoro session history is stored. It is, and
that reverses what ARCHITECTURE.md and DATABASE.md said. Only half the earlier
decision changed: a *running* timer is still never persisted on any surface,
and only an interval that has already finished is written, once, by whichever
client watched it end. The analytics the issue asked for are computed from
those rows and from nothing else.

**Still open:**
- **Retention for `pomodoro_sessions`.** It is a timestamped record of when the user works and on what — personal data with no limit on it today. Worth deciding alongside the clipboard and history windows, not separately. See SECURITY.md "Privacy".
- **Retention and encryption for body metrics and progress photos** (issue #4). Body weight, body fat, tape measurements and private photographs of the user's body — the most sensitive rows in the database, with no retention limit and no encryption at rest. The photo files are also the only user data living outside the database, so any backup plan has to cover the filesystem as well. Same decision as the three windows above, and it belongs with them.
- **Offline support for tracked workouts on Android.** The one-line entry log queues offline; routines, sessions and sets do not, because a set belongs to a session that may not exist on the server yet and the outbox would need session-id remapping before any of it could replay. Whether that is worth building is undecided. See TESTING.md.
- History auto-delete rule: schedule, which browsers/profiles, per-domain exceptions — needed before F-06 is complete. A 90-day placeholder is in `config/history.php`, clearly marked as not approved.
- Clipboard sensitivity: snippets are stored in plaintext and may contain passwords. Decide on a retention window and/or encryption at rest — see SECURITY.md.
- Sanctum token expiry (currently none) and whether a password change should revoke all tokens.
- Whether an admin/operator role exists alongside regular per-user accounts.
- Whether email verification should be enforced (scaffolded but inactive — `User` does not implement `MustVerifyEmail`).
- Environment separation from `fiyobra`'s hosting, plus deployment/rollback/monitoring — needed before anything ships.
- Success metrics and release criteria (below) remain undefined.
- Whether the add-on gets packaged and signed for distribution, or stays load-unpacked.
- Whether the existing Flutter apps `teddoro` (Pomodoro) and `budget-teddy` (Budget) should be retired now that Android covers both, and whether any of their behaviour is missing here. They were rewritten rather than ported, since merging them meant retargeting to this API regardless of language.

## Definition of ready
Partly met. The server-side scope is confirmed, built and manually verified (see TESTING.md). Acceptance criteria were never formally written per feature, three features are only partly complete pending the decisions above, and no automated tests exist yet.
