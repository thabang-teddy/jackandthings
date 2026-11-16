# Prompt — complete UI/UX rework of Jack & Things

> Paste everything below the line into a fresh session at the repo root.

---

## Mission

Do a complete rework and rethink of the **user interface and user experience** of Jack & Things across all three surfaces — the Laravel/Inertia web app in `laravel/`, the Kotlin/Compose Android client in `android/`, and the Manifest V3 add-on in `extension/`. This is not a repaint. I want the product rethought: what it is for, how a person moves through it, what they see first, what each module earns its place by doing — and then one coherent, deliberate design executed on all three surfaces.

Treat the data model, the API and the business rules as settled. Treat every pixel, every layout, every navigation decision and every piece of copy as open for change.

## Read first, then tell me what you found

1. Read `AGENTS.md`, then `docs/PRD.md`, `docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md`, `docs/CODE_STYLE.md`, `docs/TESTING.md`.
2. Inspect the real UI code before trusting the docs — `docs/DESIGN_SYSTEM.md` is **stale** and describes a Breeze baseline that has since been partly replaced.
3. Walk every screen on every surface and write down what is actually there:
   - Web: `laravel/resources/js/Pages/**`, `Layouts/AuthenticatedLayout.jsx`, `Components/Glass/**`, `Components/*.jsx` (Breeze leftovers), `Lib/themeTokens.js`, `Lib/glassNav.js`, `Lib/ThemeContext.jsx`.
   - Android: `android/app/src/main/java/com/jackandthings/ui/**`, especially `theme/GlassTokens.kt`, `theme/GlassComponents.kt`, `theme/GlassBackground.kt`, `theme/JackTheme.kt`, `theme/SystemBars.kt`, `common/Scaffolds.kt`.
   - Add-on: `extension/src/popup/popup.css`, `popup.html`, `popup.js`, `views/**`, `options/**`, `lib/dom.js`.
4. Use the browser to actually look at the web app (`php artisan serve` from `laravel/`, PowerShell, Herd PHP) at desktop **and** 375px widths, in both themes. Screenshot what you find. Do not write a design critique from source alone.

Then give me a written audit before you change anything.

## Ground truth you should not have to rediscover

- One API contract, `api/v1`, consumed by all three clients. **Do not change it.** `laravel/routes/api.php` is the contract; `android/.../data/remote/JackApi.kt` and `extension/src/lib/api.js` mirror it.
- Modules today: Home, Dashboard, Pomodoro (4 pages), Notes, Budget (10 pages), Workout (7 pages), Watch list, History, plus Profile/Settings. That is nine rail entries and roughly thirty web pages. **Nine top-level modules is itself a UX finding — interrogate it.**
- The web has a half-finished "glass" direction: `GlassShell` + `Rail` + `SubmenuPills` + `GlassCard`/`PillButton`/`GlassModal`, themed by inline CSS custom properties from `Lib/themeTokens.js`. Several modules still carry a **split** `Index.jsx` (Breeze) plus `Glass*View.jsx` pair — Notes, Workout, History, Watch list, Welcome. Auth pages and `Profile/Edit.jsx` are still Breeze, light-only. Decide the end state and remove the other.
- The three surfaces have **three unrelated palettes**: web `--accent #2B6CFF` / `--glow-2 #17D9D4`; Android Material 3 with **dynamic colour** off the wallpaper; add-on `--primary #4f46e5` indigo. Only the logo is an approved brand decision (`laravel/public/logo.svg`: the J in a `#2B6CFF` → `#17D9D4` stroke beside three fading bars).
- Nothing is decided on: palette, typeface, wordmark, spacing/grid rhythm, component anatomy, motion. No design file exists. No reference images were ever supplied.
- Accessibility is **unverified**: no contrast audit, no keyboard walkthrough, no screen-reader pass, no reduced-motion handling. Destructive actions use `window.confirm`. List and table pages have not been checked at narrow widths. Target is WCAG 2.2 AA.
- Deliberate decisions that must survive the rework, not be "fixed": the Pomodoro countdown is `role="timer"` with `aria-live="off"` on purpose; focus charts carry per-bar text labels because a bar conveys nothing otherwise; Pomodoro sounds are synthesised, never sampled, and **no audio asset ships**; strict mode means something different per surface and each UI must claim only what its platform can actually do.

## The rethink I actually want

Answer these in the audit, with a recommendation each, before writing code:

1. **What is this app for?** It bundles focus, notes, money, training, a watch list and browsing history. Is it a suite of six tools behind one login, or one product with a spine? The navigation should express the answer. Today it expresses "six tools behind one login".
2. **What does a person see when they open it?** Home and Dashboard both exist. Why two? What is the one screen that makes the app worth opening on a Tuesday morning, and what is on it?
3. **Module sprawl.** Nine rail entries, submenu pills inside several of them, ten Budget pages. Propose the information architecture you would ship — grouping, promotion, demotion, removal — and say what you would cut.
4. **Mobile web.** A fixed left rail is a desktop idea. Decide what the sub-640px web experience is, properly.
5. **Cross-module moments.** A running Pomodoro, a live workout rest timer and budget alerts all need to be present while you are elsewhere (`PomodoroFloatingRing`, `WorkoutRestPill`, `AlertsBell` exist today, ad hoc). Design one coherent system for "something is happening elsewhere in the app".
6. **The add-on's job.** 380px of popup cannot be the whole suite. Decide what the add-on is for — capture and glance, probably — and cut it to that.
7. **Android's job.** Does the phone client mirror the web, or is it the on-the-go surface (log a set, start a timer, capture a note)? Dynamic colour currently means the app has no identity of its own on Android; decide whether to keep it, and justify it either way.
8. **Empty, loading, error and first-run states.** There are empty states; there is no designed first-run, no designed error state, and loading leans on Inertia's progress bar. Fix that as part of the system, not per page.
9. **Copy.** Labels, buttons, empty-state text, validation messages. Pick a voice and apply it.

## Design direction

Do not present "clean and minimal". Propose **two or three named, specific directions** — each with a palette (light and dark, contrast-checked), a type pairing with a reason, a spacing/radius/elevation scale, a motion stance, and one sketched screen (the home screen) so I can see the difference. Build each on the approved logo's blue-to-teal, or argue explicitly for leaving it. Follow the anti-template rules in my global `web/design-quality.md`: no default card grids, no stock centred hero, no uniform radius and padding everywhere, no library defaults passed off as design. Then **stop and let me pick one.** Do not build three.

The sibling project at `C:\Users\Teddy\projects\fiyobra\laravel` shares hosting; look at it and tell me whether its visual language is worth reusing for consistency. Recommendation only — I decide.

## Execution, once I have picked

1. **One token source, three expressions.** Define the system once (palette, type scale, spacing, radius, elevation, motion durations and easings, semantic colour roles) and express it as `laravel/resources/js/Lib/themeTokens.js`, `android/.../ui/theme/GlassTokens.kt` and the add-on's `popup.css` `:root`. Same names, same values, documented as one table. A change to a token must be a change in three files and nowhere else.
2. **Component layer before pages.** Finish the shared component set on each surface so pages compose rather than style: shell, card, list row, stat, form controls (including the `<select>` and `<textarea>` cases styled inline today), buttons, modal and confirm dialog, pagination, empty/loading/error, toast. Delete the Breeze components once nothing imports them.
3. **Kill the duplication.** Resolve every `Index.jsx` + `Glass*View.jsx` pair to a single implementation. Bring auth and Profile onto the system so there is no light-only island.
4. **Then the pages**, module by module, in the order the audit argues for. Each module: layout, hierarchy, states, copy, keyboard path, 375px behaviour.
5. **Accessibility as you go, not after**: contrast checked against the real tokens, visible focus on every interactive element, labelled controls, an accessible confirm dialog replacing `window.confirm`, `prefers-reduced-motion` honoured by every animation you add, and the narrow-width pass on every table and list.
6. **Android and add-on in step with the web**, not after it. A module is done when all three surfaces agree.
7. **Update the docs.** Rewrite `docs/DESIGN_SYSTEM.md` — it is stale — and fix anything in `docs/PRD.md` and `docs/ARCHITECTURE.md` the rework invalidates. Record the decisions as decided, with the reasoning, and list what remains open.

## Constraints

- **Do not touch** the API contract, routes, controllers, policies, models, migrations or business rules unless a UI change genuinely requires it — and if it does, say so and ask first.
- Any new model-bound route means a case in `tests/Feature/Security/CrossTenantAccessTest.php`; its route-table audit fails the build otherwise. That is deliberate.
- The Pomodoro cycle rules are triplicated on purpose — `laravel/resources/js/Lib/pomodoroCycle.js`, `android/.../pomodoro/PomodoroCycle.kt`, `extension/src/lib/pomodoroCycle.js`. Change one, change all three.
- The add-on has **no build step and no dependencies**, and never assembles HTML — nodes are built with `h()` from `extension/src/lib/dom.js`. Keep both properties.
- New Inertia page? Run `npm run build` in `laravel/` — `app.blade.php` loads a per-page Vite entry, so an unbuilt page does not render.
- Windows: PHP and Composer come from Herd and are not on Git Bash's PATH — use PowerShell. Gradle needs `JAVA_HOME` pointed at Android Studio's bundled JBR. Never pipe Gradle into `Select-Object -First n` — it deadlocks; write the output to a file and filter the file.
- **Tests:** 993 pass across the four suites (`php artisan test`, `npm test` in `laravel/`, `.\gradlew.bat :app:testDebugUnitTest`, `npm test` in `extension/`). Run the relevant ones and **keep them green — fix anything the rework breaks.** Do not write new tests while implementation work is outstanding; when the rework is finished, offer me a test plan for the new UI layer. Never quote a coverage percentage — coverage is unmeasured here.
- Android ViewModels take an interface for every collaborator so they can be faked in tests. Keep that shape for anything new.
- Work on a feature branch off `dev`. Commit in reviewable slices with conventional-commit messages. **Ask me before merging to `dev` or opening a PR**, and ask then whether to add or update tests.

## How to run this

Phase 0 — audit and screenshots. Phase 1 — IA and UX recommendations answering the nine questions. Phase 2 — two or three design directions, one home screen each. **Stop. I pick.** Phase 3 — tokens and component layer. Phase 4 — modules, in order, all three surfaces. Phase 5 — accessibility sweep, docs rewrite, final verification.

Show me Phase 0 to 2 as a written plan with screenshots and sketches, and wait for my answer before Phase 3. After that, keep a task list and report what you changed, what you ran, and what you could not verify. Flag anything you had to guess instead of guessing quietly.
