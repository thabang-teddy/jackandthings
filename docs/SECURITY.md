# Security

## Assets and trust boundaries
- Protected data: budget/financial data, clipboard contents (may contain passwords or other sensitive text pasted by the user), browsing history, personal notes, workout logs, authentication credentials.
- Trusted/untrusted inputs: end users via web, Android, and browser add-ons (untrusted until authenticated); any data entering from a browser's native history/clipboard APIs (untrusted — must be validated/sanitized before storage).
- Threats relevant to this product:
  - Cross-tenant data leakage — critical given the confirmed multi-tenant model; one user must never see another user's budget, notes, workouts, clipboard, or history.
  - Clipboard content exposure — clipboard sharing is a plaintext-sensitive feature by nature (users may copy passwords, codes, etc.).
  - Over-broad browser permissions for the History add-on. Handled by making `history` an **optional** permission requested only when that feature is used, rather than granted at install; recording and auto-delete are then two further opt-ins. Auto-delete destroys the user's own browser history, so it also confirms before a manual run.
  - Unauthorized or abusive API access (no rate limiting designed yet).

## Authentication and authorization
- Identity: Laravel Breeze session auth for the web app; Laravel Sanctum v4.3 bearer tokens for non-browser clients, both email + password (built).
- Roles and permissions: every user has an identical single role scoped to only their own data. There is deliberately no `Gate::before()` admin bypass, so no role can skip an ownership check. Whether an admin/operator role should exist is still **unresolved** — nothing in the code grants one.
- Ownership/tenant checks (built, three layers): relation-scoped queries, an explicitly-registered policy per model comparing `user_id`, and ownership-scoped `Rule::exists` in FormRequests. A bound-but-foreign record aborts **404, not 403**, so existence is never confirmed to a non-owner. Verified: 9 web routes and 5 API endpoints all return 404 to a second user, and a SQL audit found zero cross-owner rows.
- Recovery and revocation: Breeze's password reset flow is scaffolded (mailer is `log` locally, so reset links appear in the log rather than being sent). `DELETE /api/v1/auth/token` revokes only the calling device's token, verified to turn subsequent requests into 401. Each token is named after the issuing device, so they can be told apart. **Unresolved:** revoking all tokens on password change / "sign out everywhere", and any UI for listing or revoking a lost device's token.
- A 401 from any API call clears the Android session centrally (`ApiClient.onUnauthenticated`), so a revoked token drops that device to sign-in rather than leaving it in a broken state.

## Secrets and configuration
- Secret names only (in `laravel/.env`, which is git-ignored): `APP_KEY`, `DB_USERNAME`, `DB_PASSWORD`, `SANCTUM_STATEFUL_DOMAINS`, `HISTORY_RETENTION_DAYS` (not a secret, but environment-driven), plus Laravel's unset `MAIL_*` and `AWS_*` defaults. No third-party service credentials exist because no third-party service is used.
- The local MySQL credentials are development-only (`jackandthings`/`secret`, same convention as fiyobra's local setup) and must not be reused for any deployed environment.
- Storage and rotation: **unresolved** — no deployment exists yet, so no production secret store has been chosen.
- Client exposure: the Android app and add-ons receive only a Sanctum bearer token, never server config. Note Sanctum tokens here have **no expiry** (fiyobra sets `SANCTUM_TOKEN_EXPIRATION_MINUTES` and prunes expired tokens daily) — adopting an expiry plus `sanctum:prune-expired` is a recommended follow-up, currently **unresolved**. It matters more now that a real device holds a token indefinitely.
- On Android the token is held in `EncryptedSharedPreferences` (keystore-backed), with a documented fallback to a private preference file if the device's keystore refuses, so a broken keystore degrades rather than blocking sign-in. Signing out clears it locally even when the server call fails, which does leave a stale token row server-side — another reason to configure expiry.
- The Android app ships `network_security_config.xml` with cleartext **off by default**, excepting only `10.0.2.2`, `127.0.0.1` and `localhost` so a local dev server works. Any real deployment is therefore HTTPS-only without a further change. The release build is currently signed with debug keys and is **not distributable**.

## Input and output handling
- Validation (built): one FormRequest per action in `laravel/app/Http/Requests`, with length caps, numeric bounds on money, ownership-scoped `Rule::exists` on any referenced record, per-user unique account names, and cross-field checks (insufficient funds, transfer to a different account). `BudgetService` re-asserts the funds rule independently of the request layer.
- Injection/XSS: Eloquent/query-builder parameterised queries throughout; React escapes by default. The one deliberate `dangerouslySetInnerHTML` is in `Components/Pagination.jsx`, rendering Laravel's own paginator labels (`&laquo;`), not user input. The add-on builds every node with `textContent` and its `h()` helper throws if handed raw HTML, because note bodies, snippets and page titles all reach it as data.
- Add-on network posture: cross-origin calls rely on the API host being in `host_permissions`, requested at runtime for whatever server the user configures rather than shipping a wildcard. Laravel answers the preflight with `Access-Control-Allow-Origin: *`, which is acceptable only because these routes are bearer-token authenticated and carry no cookie auth — it should be narrowed if cookie-based auth is ever added to `api/*`.
- The add-on stores its token in `chrome.storage.local`, which is origin-isolated but **not encrypted**, unlike the Android client's keystore-backed store. Acceptable for a desktop profile, worth noting as the weakest of the three.
- Mass assignment: `user_id` is not fillable on any model; ownership is only ever set by creating through the authenticated user's relation.
- Upload restrictions: not applicable — no file upload feature exists.
- Rate limits (built): `POST /api/v1/auth/token` is throttled to 6/min (the password-guessing surface); all other authenticated API routes 60/min. Breeze throttles its own login route. **Unresolved:** whether the web module routes need write throttling (fiyobra throttles its write routes individually).

## Privacy
- Data collected and purpose: budget transactions, notes, workout logs, clipboard snippets, and browsing history — all for the user's own personal productivity use, per PRD.md.
- Retention/deletion (built): deleting a user cascades every module row. History entries are hard-deleted by `history:prune` past the retention window — currently a **placeholder** 90 days (`config/history.php`), explicitly not an approved rule.
- **Unresolved and worth deciding soon:** clipboard snippets are stored in plaintext and may hold passwords or one-time codes. The Android client raises the stakes: it can capture the system clipboard and accept text from the share sheet, so whatever is copied on the phone can end up in the database. Options are a short retention window, encryption at rest (fiyobra uses Laravel's `encrypted` cast for sensitive columns — deliberately not copied here), or both. Browsing history is likewise plaintext and indefinite until pruned.
- Logging redaction: no module data is written to logs today, and nothing should be added that logs clipboard contents, budget identifiers, or credentials/tokens. Not enforced by tooling — reviewer responsibility.

## Dependencies and deployment
- Dependency review/update policy: **unresolved**. `composer audit` reported no advisories at install time.
- Environment separation: **unresolved** and still the main deployment risk — this project will share hosting infrastructure with `fiyobra` (confirmed), so separation needs an explicit decision before anything is deployed. Nothing has been deployed.
- Security-sensitive change review: **unresolved** — no process defined.

## Verification
See TESTING.md for exactly what was checked by hand and what the results were. In summary: cross-tenant access returns 404 on all 9 web routes and 5 API endpoints tested, a SQL audit found zero cross-owner writes, and the API token lifecycle (401 without token, 422 on bad credentials, 204 revoke, 401 after revoke) behaves correctly.

**No automated security tests exist.** The isolation checks above were manual and are not protected against regression — a written tenant-isolation suite (ideally fiyobra's self-auditing route-table sweep) is the single highest-value test to add. This document does not establish regulatory compliance.
