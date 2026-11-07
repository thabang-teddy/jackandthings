# Design System

> No design direction was supplied (owner chose "propose something"), so the built web UI deliberately stays on the **Laravel Breeze + Tailwind baseline** rather than inventing a bespoke visual language ahead of approval. It is coherent and accessible, not distinctive. The tokens below remain **proposals**; nothing here is an approved brand decision.
>
> What is actually built: Breeze's React/Tailwind scaffolding with dark-mode support enabled, a six-module top nav in `AuthenticatedLayout.jsx`, and three shared components added for consistency across modules — `PageShell` (page title + action slot + container), `EmptyState`, and `Pagination`. Money is rendered via `Lib/formatZar.js` (`Intl.NumberFormat('en-ZA')`). Picking a real direction is an open task.

## Design direction
- Brand attributes (proposal): calm, focused, trustworthy — chosen because the suite mixes focus tools (Pomodoro), money (Budget), and health (Workout), where a trustworthy, low-noise feel suits all three.
- Supported devices: web (desktop + mobile responsive, via Inertia/React), Android (native Kotlin/Compose, built), browser add-on popups (Chrome/Firefox, not built) — confirmed from `docs/init.txt` and prior answers.
- The two built surfaces currently look like their respective platform defaults rather than like each other: the web app sits on Breeze's Tailwind baseline, while Android uses Material 3 with **dynamic colour**, taking its palette from the user's wallpaper on Android 12+. That follows from there being no approved palette yet; it is not a decision that they should diverge. Agreeing a palette is what would bring them together.
- References: none supplied. **Unresolved** — propose reusing the sibling project's (`fiyobra`) visual language for consistency if one exists; needs owner confirmation.

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
