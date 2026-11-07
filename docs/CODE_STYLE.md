# Code Style

Reflects the Laravel app as built in `laravel/`. Conventions follow the sibling project `C:\Users\Teddy\projects\fiyobra\laravel` except where noted.

## Languages and conventions
- PHP 8.4 locally (`composer.json` requires `^8.3`), Laravel v13.40.0. Plain JavaScript + React 18 via Inertia — **no TypeScript**, matching fiyobra.
- Kotlin for the Android app (not started).
- `declare(strict_types=1);` at the top of every hand-written PHP file (matches fiyobra, which uses it throughout `app/`). Framework-generated files (Breeze controllers, the default `User` model shell) are left as generated.
- Typed properties, parameter types, and return types on all new code. Constructor property promotion with `private readonly` for injected services.
- Naming: models singular (`BudgetAccount`), tables plural snake_case (`budget_accounts`), controllers `<Thing>Controller`, FormRequests `<Thing>Request`, policies `<Thing>Policy`. React components and pages PascalCase; hooks `use*`.
- Enums over magic strings: `App\Enums\BudgetTransactionType` is a string-backed enum, cast on the model.
- Laravel 13's attribute style is used for model mass-assignment (`#[Fillable([...])]`), matching the framework's own generated `User` model. **`user_id` is never fillable** anywhere — ownership is set only by creating through the user relation.

## Organization
- Controllers are nested by area: `Http/Controllers/Web/` (session guard, returns Inertia) and `Http/Controllers/Api/V1/` (token guard, returns JSON). Simpler than fiyobra's `Admin/Dashboard/Manage/Site` split because there is no public or admin surface here — every record is already "mine".
- `app/Models/` flat; `app/Policies/` flat; `app/Http/Requests/` flat.
- Business logic lives in `app/Services/` (`BudgetService`, `WorkoutReminderStatus`), not in controllers — controllers stay transport-only. Cross-cutting controller behavior goes in `app/Http/Controllers/Concerns/` (`AuthorizesOwnership`).
- React: `Pages/` mirrors module names, `Components/` holds shared UI, `Layouts/AuthenticatedLayout.jsx` owns the nav, `Lib/` holds pure helpers.
- Inertia pages attach their layout via the static-property convention `Page.layout = (page) => <AuthenticatedLayout>{page}</AuthenticatedLayout>` (same as fiyobra).

## Coding rules
- Keep functions focused; follow established repository patterns.
- Validate external inputs at the trust boundary — always a FormRequest, never inline `$request->validate()` in new module code.
- Query through the authenticated user's relation; never `Model::where('user_id', $request->input(...))`.
- A failed ownership check aborts 404, never 403.
- Handle loading, empty, error, and success states explicitly — every list page has an `EmptyState`.
- Money is integer cents end to end; formatting happens only in `Lib/formatZar.js`.
- Avoid silent failures and undocumented magic values.
- Reuse existing components before introducing new abstractions.
- No `console.log` in committed frontend code.

## Errors and logging
- Web: validation failures redirect back with field errors, rendered by `InputError`. Success uses a flashed `status` message shared through `HandleInertiaRequests` and rendered once in `AuthenticatedLayout`.
- API: Laravel's default JSON validation shape (422); `204` for deletes; `201` for creates; resources wrapped in a `data` key.
- Domain failures throw (`InsufficientFundsException`) rather than returning false.
- Logging: Laravel's default `stack`/`single` channel. Per SECURITY.md, clipboard contents, budget identifiers, and credentials/tokens must never be logged.

## Dependencies
- Installed deliberately and kept minimal: `inertiajs/inertia-laravel`, `tightenco/ziggy`, `laravel/sanctum`, `laravel/breeze` (dev). Deliberately **not** carried over from fiyobra: Sentry, Spatie activity log, 2FA, web-push/FCM, Redis, S3.
- `composer.lock` and `package-lock.json` are committed.
- New packages: discuss before adding — no formal policy agreed yet.

## Review checklist
- Implementation matches the approved feature acceptance criteria.
- Format and lint run clean using the confirmed commands below.
- Ownership: new model → relation on `User`, policy registered in `AuthServiceProvider::POLICIES`, `authorizeOwned()` on every bound route, scoped `Rule::exists` for any cross-record reference.
- No credentials or unrelated files in the diff.

## Verified commands
All of these were run successfully in this repository:
- Format: `vendor/bin/pint` (Laravel Pint v1.32.1)
- Lint (JS): `npm run lint` (ESLint + Prettier)
- Build: `npm run build` (Vite)
- Dev: `php artisan serve` + `npm run dev`, or `composer run dev`
- Migrate: `php artisan migrate`, `php artisan migrate:fresh --seed`
- Inspect: `php artisan route:list`, `php artisan schedule:list`
- Prune history: `php artisan history:prune` (accepts `--days=`)

Note: new Inertia pages must be rebuilt (`npm run build`) or served by `npm run dev` before they will render — `resources/views/app.blade.php` loads a per-page Vite entry, so a page missing from the manifest fails.

There is **no type-check step** (no TypeScript) and **no static analyser** configured — PHPStan/Psalm are not installed. Never invent commands or claim checks passed without running them.
