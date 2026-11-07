# Security

## Assets and trust boundaries
- Protected data: budget/financial data, clipboard contents (may contain passwords or other sensitive text pasted by the user), browsing history, personal notes, workout logs, authentication credentials.
- Trusted/untrusted inputs: end users via web, Android, and browser add-ons (untrusted until authenticated); any data entering from a browser's native history/clipboard APIs (untrusted — must be validated/sanitized before storage).
- Threats relevant to this product:
  - Cross-tenant data leakage — critical given the confirmed multi-tenant model; one user must never see another user's budget, notes, workouts, clipboard, or history.
  - Clipboard content exposure — clipboard sharing is a plaintext-sensitive feature by nature (users may copy passwords, codes, etc.).
  - Over-broad browser permissions for the History add-on (reading/deleting browsing history requires sensitive extension permissions).
  - Unauthorized or abusive API access (no rate limiting designed yet).

## Authentication and authorization
- Identity: Laravel Breeze session auth for the web app; Laravel Sanctum v4.3 bearer tokens for non-browser clients, both email + password (built).
- Roles and permissions: every user has an identical single role scoped to only their own data. There is deliberately no `Gate::before()` admin bypass, so no role can skip an ownership check. Whether an admin/operator role should exist is still **unresolved** — nothing in the code grants one.
- Ownership/tenant checks (built, three layers): relation-scoped queries, an explicitly-registered policy per model comparing `user_id`, and ownership-scoped `Rule::exists` in FormRequests. A bound-but-foreign record aborts **404, not 403**, so existence is never confirmed to a non-owner. Verified: 9 web routes and 5 API endpoints all return 404 to a second user, and a SQL audit found zero cross-owner rows.
- Recovery and revocation: Breeze's password reset flow is scaffolded (mailer is `log` locally, so reset links appear in the log rather than being sent). `DELETE /api/v1/auth/token` revokes only the calling device's token, verified to turn subsequent requests into 401. **Unresolved:** revoking all tokens on password change / "sign out everywhere".

## Secrets and configuration
- Secret names only (in `laravel/.env`, which is git-ignored): `APP_KEY`, `DB_USERNAME`, `DB_PASSWORD`, `SANCTUM_STATEFUL_DOMAINS`, `HISTORY_RETENTION_DAYS` (not a secret, but environment-driven), plus Laravel's unset `MAIL_*` and `AWS_*` defaults. No third-party service credentials exist because no third-party service is used.
- The local MySQL credentials are development-only (`jackandthings`/`secret`, same convention as fiyobra's local setup) and must not be reused for any deployed environment.
- Storage and rotation: **unresolved** — no deployment exists yet, so no production secret store has been chosen.
- Client exposure: the Android app and add-ons receive only a Sanctum bearer token, never server config. Note Sanctum tokens here have **no expiry** (fiyobra sets `SANCTUM_TOKEN_EXPIRATION_MINUTES` and prunes expired tokens daily) — adopting an expiry plus `sanctum:prune-expired` is a recommended follow-up, currently **unresolved**.

## Input and output handling
- Validation (built): one FormRequest per action in `laravel/app/Http/Requests`, with length caps, numeric bounds on money, ownership-scoped `Rule::exists` on any referenced record, per-user unique account names, and cross-field checks (insufficient funds, transfer to a different account). `BudgetService` re-asserts the funds rule independently of the request layer.
- Injection/XSS: Eloquent/query-builder parameterised queries throughout; React escapes by default. The one deliberate `dangerouslySetInnerHTML` is in `Components/Pagination.jsx`, rendering Laravel's own paginator labels (`&laquo;`), not user input.
- Mass assignment: `user_id` is not fillable on any model; ownership is only ever set by creating through the authenticated user's relation.
- Upload restrictions: not applicable — no file upload feature exists.
- Rate limits (built): `POST /api/v1/auth/token` is throttled to 6/min (the password-guessing surface); all other authenticated API routes 60/min. Breeze throttles its own login route. **Unresolved:** whether the web module routes need write throttling (fiyobra throttles its write routes individually).

## Privacy
- Data collected and purpose: budget transactions, notes, workout logs, clipboard snippets, and browsing history — all for the user's own personal productivity use, per PRD.md.
- Retention/deletion (built): deleting a user cascades every module row. History entries are hard-deleted by `history:prune` past the retention window — currently a **placeholder** 90 days (`config/history.php`), explicitly not an approved rule.
- **Unresolved and worth deciding soon:** clipboard snippets are stored in plaintext and may hold passwords or one-time codes. Options are a short retention window, encryption at rest (fiyobra uses Laravel's `encrypted` cast for sensitive columns — deliberately not copied here), or both. Browsing history is likewise plaintext and indefinite until pruned.
- Logging redaction: no module data is written to logs today, and nothing should be added that logs clipboard contents, budget identifiers, or credentials/tokens. Not enforced by tooling — reviewer responsibility.

## Dependencies and deployment
- Dependency review/update policy: **unresolved**. `composer audit` reported no advisories at install time.
- Environment separation: **unresolved** and still the main deployment risk — this project will share hosting infrastructure with `fiyobra` (confirmed), so separation needs an explicit decision before anything is deployed. Nothing has been deployed.
- Security-sensitive change review: **unresolved** — no process defined.

## Verification
See TESTING.md for exactly what was checked by hand and what the results were. In summary: cross-tenant access returns 404 on all 9 web routes and 5 API endpoints tested, a SQL audit found zero cross-owner writes, and the API token lifecycle (401 without token, 422 on bad credentials, 204 revoke, 401 after revoke) behaves correctly.

**No automated security tests exist.** The isolation checks above were manual and are not protected against regression — a written tenant-isolation suite (ideally fiyobra's self-auditing route-table sweep) is the single highest-value test to add. This document does not establish regulatory compliance.
