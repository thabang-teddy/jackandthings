# Design System

> No design direction was supplied (owner chose "propose something"), so the built web UI deliberately stays on the **Laravel Breeze + Tailwind baseline** rather than inventing a bespoke visual language ahead of approval. It is coherent and accessible, not distinctive. The tokens below remain **proposals**. The one approved brand decision is the logo — see "Brand mark".
>
> What is actually built: Breeze's React/Tailwind scaffolding with dark-mode support enabled, a six-module top nav in `AuthenticatedLayout.jsx`, and three shared components added for consistency across modules — `PageShell` (page title + action slot + container), `EmptyState`, and `Pagination`. Money is rendered via `Lib/formatZar.js` (`Intl.NumberFormat('en-ZA')`). Picking a real direction is an open task.

## Design direction
- Brand attributes (proposal): calm, focused, trustworthy — chosen because the suite mixes focus tools (Pomodoro), money (Budget), and health (Workout), where a trustworthy, low-noise feel suits all three.
- Supported devices: web (desktop + mobile responsive, via Inertia/React), Android (native Kotlin/Compose), browser add-on popup (Chrome/Firefox) — all three built.
- The three surfaces currently look like their respective platform defaults rather than like each other: the web app sits on Breeze's Tailwind baseline, Android uses Material 3 with **dynamic colour** (taking its palette from the wallpaper on Android 12+), and the add-on uses its own small CSS-custom-property sheet with a `prefers-color-scheme` dark mode. That follows from there being no approved palette yet; it is not a decision that they should diverge. Agreeing a palette is what would bring them together — and the add-on's `popup.css` `:root` block is the closest thing to a token file that exists, so it is a reasonable place to start.
- References: none supplied. **Unresolved** — propose reusing the sibling project's (`fiyobra`) visual language for consistency if one exists; needs owner confirmation.

## Brand mark
**Approved** by the owner. The mark is a "J" beside three bars that fade out — the two halves of "Jack & Things", and an echo of the list-and-card surfaces the app is actually made of. It is drawn in a 64-unit square; the bars are `#2B6CFF` at 90/60/38% opacity and the J is a round-capped 8-unit stroke running `#2B6CFF` → `#17D9D4` top to bottom. Those two colours are the `--accent` and `--glow-2` already set in `laravel/resources/js/Lib/themeTokens.js`, so the mark needs no palette of its own.

The master is `laravel/public/logo.svg`. Everything else is derived from it:

| Surface | Asset | Notes |
| --- | --- | --- |
| Web | `laravel/public/logo.svg` | Full three-bar mark |
| Web | `laravel/public/favicon.svg` | Two-bar cut, thicker strokes — the three-bar version silts up below ~24px |
| Web | `laravel/public/favicon.ico` | 16/32/48, PNG-in-ICO |
| Web | `laravel/public/apple-touch-icon.png` | 180px, mark on `#0A0F1E` |
| Web | `Components/Glass/GlassLogo.jsx` | Inline copy for the rail; kept in sync with `logo.svg` by hand |
| Add-on | `extension/icons/icon-{16,32,48,128}.png` | 16/32 use the two-bar cut; transparent background |
| Android | `res/drawable/ic_launcher_{foreground,background,monochrome}.xml` | Vector adaptive icon: white mark on the brand gradient, plus a themed-icon silhouette |

The PNGs are rendered from the SVGs with headless Chrome rather than an image library, so the repo gains no dependency; re-render them by hand if the mark changes.

**Not decided:** a wordmark. The marketing lockup in the options sheet set "Jack & Things" in the system stack with the ampersand in `#17D9D4`, but no typeface has been chosen, so there is no wordmark asset in the repo — only the symbol.

## UI tokens
All values below are proposals — no approved values exist yet.
| Token | Value | Usage |
| --- | --- | --- |
| color.background | Proposal: neutral off-white / near-black (light+dark) | Main canvas |
| color.text | Proposal: high-contrast neutral gray-900 / gray-50 | Primary copy |
| color.primary | Proposal: single accent hue, TBD | Main actions |
| color.error | Proposal: red, WCAG-AA compliant against background | Errors with text labels |
| font.body | Proposal: system font stack (no custom font decided) | Body copy |
| space.unit | Proposal: 4px base scale | Spacing scale |
| radius.control | Proposal: 8px | Inputs and buttons |

## Layout rules
As built (Breeze defaults plus `PageShell`): `max-w-5xl` container on module pages, `max-w-7xl` on the nav bar, `px-4 sm:px-6 lg:px-8` gutters, Tailwind's default breakpoints. Card surfaces are `bg-white dark:bg-gray-800 rounded-lg shadow-sm` on a `bg-gray-100 dark:bg-gray-900` canvas. Formal grid/rhythm rules: **unresolved**.

## Components
Breeze supplies `PrimaryButton`, `SecondaryButton`, `DangerButton`, `TextInput`, `InputLabel`, `InputError`, `Checkbox`, `Modal`, `Dropdown`, `NavLink`, `ResponsiveNavLink` — with their own hover/focus/disabled states. Added for this app: `PageShell`, `EmptyState`, `Pagination`. Native `<select>` and `<textarea>` elements are styled inline to match `TextInput`; extracting them into proper components is a tidy-up worth doing. Full anatomy/state documentation: **unresolved**.

## Accessibility
Breeze's components ship with visible focus rings and sensible semantics, and every form control in the new pages has an associated `InputLabel`. Beyond that, **nothing has been verified** — no contrast audit, no keyboard walkthrough, no screen-reader pass, no reduced-motion handling. Known gaps: destructive actions use `window.confirm` rather than an accessible dialog; the Pomodoro countdown is not announced to assistive tech; list/table pages have not been checked at narrow widths. Proposed baseline remains WCAG 2.2 AA.

## Screen states
Each list page has an explicit empty state, and forms render per-field validation errors plus a flashed success message in the layout. Loading state relies on Inertia's progress bar and `processing`-disabled submit buttons. Dedicated error states (e.g. a failed request) are **unresolved**.

## Approval
Design owner: Thabang Teddy Morwasetla. Source of truth: **unresolved** — no design file exists. The current UI is a functional baseline awaiting a design decision, not an approved design.
