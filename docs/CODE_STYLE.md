# Code Style

Reflects the Laravel app as built in `laravel/`. Conventions follow the sibling project `C:\Users\Teddy\projects\fiyobra\laravel` except where noted.

## Languages and conventions
- PHP 8.4 locally (`composer.json` requires `^8.3`), Laravel v13.40.0. Plain JavaScript + React 18 via Inertia — **no TypeScript**, matching fiyobra.
- Kotlin 2.2.21 + Jetpack Compose for the Android app, JVM target 17, official Kotlin code style.
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

## Kotlin (android/)
- `val` over `var`; immutable `data class` state; updates via `copy()`. No `!!` anywhere — use `?.`, `?:` or an early return.
- One immutable state object per screen in a `MutableStateFlow`, exposed as `StateFlow` and collected with `collectAsStateWithLifecycle()`. ViewModels expose named action methods rather than a sealed event sink; the single-state-object and one-way-data-flow parts are what matter.
- ViewModels are constructed through a `companion object { fun factory(deps) }` using `viewModelFactory { initializer { … } }`, which is how manual DI meets `viewModel()`.
- Repositories return `Result<T>` and are the only layer that talks to `JackApi`. Wrap calls in `apiCall { }` from `repo/ApiResult.kt`, **not** `runCatching` — the former rethrows `CancellationException` instead of turning a cancelled coroutine into a fake failure.
- One file per screen and per ViewModel; shared composables live in `ui/common/`.
- Money is `Long` cents end to end, formatted only by `formatZar()` (en-ZA). Amounts are sent to the server as the user's typed string so no float touches money.
- Wire models are `@Serializable` with explicit `@SerialName` for every field whose JSON name differs, so a rename on either side fails loudly rather than arriving as null. R8 keep rules for them live in `proguard-rules.pro`.

## Browser add-on (extension/)
- Plain ES modules, **no build step and no dependencies** — it loads unpacked exactly as committed. Keep it that way unless there is a real reason not to: it is the only surface that can read browsing history, so being readable without a bundle is part of its security story.
- Use the `ext` export from `lib/ext.js` (`browser ?? chrome`) rather than touching `chrome.*` directly, so Firefox and Chrome share one path.
- **Never assemble HTML.** Build nodes with the `h()` helper in `lib/dom.js`, which sets `textContent` and throws if handed an `html` prop. Server data and page titles both land here.
- Anything needing a permission beyond the install-time set checks `hasPermission()` first and asks with `requestPermission()` at the moment of use, not up front.
- Work that must outlive the popup belongs in the service worker behind a `chrome.alarms` alarm — a popup is destroyed the instant it loses focus, so an interval in popup script is never the answer.
- Money and dates reuse `lib/format.js`, which mirrors the other two clients (integer cents, en-ZA).

## Android dependency policy
The version catalog in `android/gradle/libs.versions.toml` is pinned as a **set** copied from `giwubible/kotlin`, which already builds on this machine. Bump it deliberately, not routinely: the newer AndroidX line raises the minimum SDK. `android.builtInKotlin=false` in `gradle.properties` is load-bearing — AGP 9 ships its own Kotlin support and otherwise rejects the standalone Kotlin plugin that the Compose and serialization plugins attach to. The other `android.*` flags there are deprecated and only quiet warnings.

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
All of these were run successfully in this repository.

**Android** (from `android/`, with `JAVA_HOME` set to Android Studio's bundled JBR at `C:\Program Files\Android\Android Studio\jbr`):
- Build: `.\gradlew.bat :app:assembleDebug`
- Compile only: `.\gradlew.bat :app:compileDebugKotlin`
- Point at another server without editing source: `-PjackApiBaseUrl=https://host/api/v1/`
- Install/run: `adb install -r app\build\outputs\apk\debug\app-debug.apk` then `adb shell am start -n com.jackandthings/.MainActivity`
- The app expects `php artisan serve` (port 8000) for emulator testing; Herd's `jackandthings.test` is not resolvable from the emulator.

**Add-on** (from the repo root):
- There is no build or lint step. Syntax was checked by copying each module to `.mjs` and running `node --check`; worth repeating after edits.
- Load it by hand: Chrome `chrome://extensions` → Developer mode → "Load unpacked" → `extension/`; Firefox `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on" → `extension/manifest.json`. Chrome 156 rejects `--load-extension`, so there is no scripted route.

**Laravel** (from `laravel/`):
- Format: `vendor/bin/pint` (Laravel Pint v1.32.1)
- Lint (JS): `npm run lint` (ESLint + Prettier)
- Build: `npm run build` (Vite)
- Dev: `php artisan serve` + `npm run dev`, or `composer run dev`
- Migrate: `php artisan migrate`, `php artisan migrate:fresh --seed`
- Inspect: `php artisan route:list`, `php artisan schedule:list`
- Prune history: `php artisan history:prune` (accepts `--days=`)

Note: new Inertia pages must be rebuilt (`npm run build`) or served by `npm run dev` before they will render — `resources/views/app.blade.php` loads a per-page Vite entry, so a page missing from the manifest fails.

There is **no type-check step** on the web side (no TypeScript) and **no static analyser** configured — PHPStan/Psalm are not installed, and neither are ktlint or Detekt for Kotlin. Never invent commands or claim checks passed without running them.
