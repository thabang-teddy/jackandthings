# Design brief — Jack & Things

**Client:** Thabang Teddy Morwasetla
**Engagement:** Full UI/UX design for a cross-platform personal productivity suite
**Deliverable:** three complete design directions, as PDFs (spec in section 7)
**Date issued:** _______  **Response due:** _______  **Fee / timeline:** to be proposed by you

---

## 1. What I need, in one paragraph

Jack & Things is a personal productivity suite that is **already built and working** on three platforms — a responsive web app, an Android app, and a browser extension. The functionality is done; the design is not. I want you to design the product properly, from scratch, and bring me **three distinct directions**, each covering **every screen** listed in section 6, as a PDF. I will pick one and commission the handover from there.

I am not asking you to improve something. I am asking you to design it.

## 2. I am deliberately not showing you the current interface

There are no screenshots attached and I would rather you did not go looking for a build. The current interface is framework defaults with a half-finished look layered on top, and I do not want it anchoring you — not its layout, not its navigation, not its colours. Everything you need is in this brief: what the product does, what each screen has to show, and what a person is trying to do on it.

If something here is too thin to design from, ask me and I will describe the behaviour in more detail. I will answer in words, not pictures.

## 3. The product

**What it is.** Six tools behind one private login, so that focus, money, training and the small admin of a day live in one place instead of six apps. Every user's data is their own; there are no shared, family or team accounts.

**Who uses it.** Individual account holders. South Africa — currency is rand, fixed; units are metric, fixed. Treat it as a product that has to stand up next to commercial apps in each of its categories, not an internal tool.

**Where it runs.**

| Surface | Built with | What you should know |
| --- | --- | --- |
| Web | Laravel + Inertia + React + Tailwind | Desktop and mobile browser. Carries everything. |
| Android | Kotlin + Jetpack Compose, Material 3 | Phone only. You are reshaping a platform design system, not drawing on blank canvas — say where you override it. |
| Browser extension | Chrome / Firefox, Manifest V3 | A popup, **380 px wide**, 420–580 px tall. Carries a subset by design. No build step and no dependencies: plain CSS, plain DOM, no icon font, no framework. |

**The six modules.**

1. **Pomodoro** — a focus timer with saved presets, long breaks on a configurable cycle, auto-start choices, a category tag per session, generated alarm/ticking/background sound, a "strict mode", and daily and weekly focus analytics.
2. **Notes** — titled notes with a body. Create, read, update, delete.
3. **Budget** — several accounts/wallets per user, income and spend against them, transfers between the user's own accounts, spending categories, monthly caps per category, savings goals, recurring items, receipt images on a transaction, reports, and CSV export. Amounts are ZAR, stored in integer cents.
4. **Workout** — an exercise library, saved routines, live set-by-set logging with a rest timer and previous numbers shown while training, body measurements with private progress photos, personal records, and a consistency calendar.
5. **Watch list** — user-made lists and the items in them.
6. **History** — browsing history recorded by the extension, with a retention rule that auto-deletes old URLs.

Plus a landing page for signed-out visitors, authentication, a home screen, a dashboard, and account settings.

## 4. What is fixed and what is open

**Fixed — design around these:**

- The six modules and what each one does. The features are built; I am not changing the data model or the rules for a layout.
- **The logo.** A capital "J" in a round-capped stroke running `#2B6CFF` at the top to `#17D9D4` at the bottom, beside three horizontal bars fading out at 90% / 60% / 38% opacity. It is the one design decision already approved. Vector master supplied. Build a palette on those two colours, or argue explicitly for retiring them — but say which you are doing.
- Currency is ZAR formatted `en-ZA`; units are metric (kg, km, mm). No per-user preference for either.
- Light **and** dark are both required, and both have to look deliberate. Dark is not an inverted afterthought.
- The extension popup is 380 px. A browser constraint, not a choice.
- Pomodoro sounds are generated in code, never sampled — no audio file ships with the product. So no concept that leans on licensed audio.
- WCAG 2.2 AA.

**Open — I want your opinion on all of it:**

- Palette, typography, spacing and grid, radii, elevation and depth, iconography, motion, illustration or texture, whether there is a wordmark.
- **The information architecture.** Six modules plus a home and a dashboard is a lot of surface. What is top-level, what is nested, what gets merged, and whether a separate home *and* dashboard both earn their place. Budget alone has nine screens' worth of content and Workout six — tell me how that should be organised.
- What the first screen is and what is on it. What makes this worth opening on a Tuesday morning.
- Mobile web navigation, considered properly rather than as a desktop layout squeezed.
- One coherent treatment for **"something is running elsewhere in the app"** — a Pomodoro counting down, a workout rest timer running, a budget cap breached — while the user is on another screen.
- What the extension is *for* in 380 px, and what the phone is for versus the browser. My instinct is the extension is capture-and-glance and the phone is on-the-go, but convince me either way.
- First-run, empty, loading and error states as part of the system rather than per screen.
- Voice and copy — button labels, empty-state text, validation messages.
- The product name. "Jack & Things" is a working title.

## 5. How I will choose

In order of weight:

1. **Does the information architecture make the product easier to use?**
2. **Does it have a point of view** — would it be recognisable without the logo?
3. **Does it survive the hard screens** — a nine-screen budget module, a live workout log, a 380 px popup — and not only the home screen?
4. **Is it accessible** — contrast checked, focus visible, legible at the sizes you specify.
5. **Is it buildable** by one developer on Tailwind, Compose and plain CSS, composing from a kit rather than hand-engineering each screen.

Things I do not want in any of the three: a default card grid with uniform padding; a centred hero with a gradient blob; component-library defaults presented as a design; one corner radius and one shadow on everything; grey-on-white with a single accent standing in for a palette. And please do not bring me "clean and minimal" three times — three genuinely different answers to "what kind of product is this", not one idea at three saturations.

Directions worth considering if one fits: editorial/magazine, Swiss/International, dark or light luxury with disciplined contrast, bento layouts, neo-brutalism, glassmorphism with real depth, retro-futurism. A starting point, not a label to apply.

For tone and bar-setting, not copying: Things 3 and Todoist on calm, Linear on density done well, YNAB and Monarch Money on making money legible, Strong and Hevy on logging a set in three taps, Notion on breadth without chaos.

**On type:** whatever face you choose must be licensable for a web app, an Android app and a browser extension at once. If a face would be expensive or awkward across all three, say so and name a fallback. Numerals matter — this product shows money and weights constantly.

## 6. Every screen, and what is on it

**All of these, in all three options.** Web screens at desktop **and** 375 px. Every screen in **light and dark**.

### 6.1 Web — signed out (7)

| # | Screen | Must show |
| --- | --- | --- |
| 1 | Landing page | What the product is, the six modules, a reason to sign up, sign-in entry |
| 2 | Sign in | Email, password, remember me, forgot-password link, error state |
| 3 | Register | Name, email, password, confirm password, validation errors |
| 4 | Forgot password | Email, confirmation message |
| 5 | Reset password | New password, confirm, token-expired state |
| 6 | Confirm password | Single password re-entry before a sensitive action |
| 7 | Verify email | Prompt, resend, success |

### 6.2 Web — core (3)

| # | Screen | Must show |
| --- | --- | --- |
| 8 | Home | Your answer to "what opens the app". Live clock, what is happening now, what needs attention across all six modules |
| 9 | Dashboard | A cross-module overview: focus today, balances, training streak, recent notes, alerts. Decide how this differs from Home — or merge them and say so |
| 10 | Settings / account | Profile name and email, change password, delete account (destructive confirm), theme choice, notification preferences |

### 6.3 Web — Pomodoro (4)

| # | Screen | Must show |
| --- | --- | --- |
| 11 | Timer | Large countdown mid-session, current phase (focus / short break / long break), position in the cycle, preset in use, tag, start/pause/skip/stop, strict-mode indicator. Design the running, paused and finished states |
| 12 | Presets | List of saved presets with their durations, cycle length, auto-start, sound and strict-mode flags; create and edit form; delete confirm; empty state |
| 13 | Sessions | A history list of finished intervals — date, duration, phase, tag — with paging and a delete action; empty state |
| 14 | Stats | Daily and weekly focus totals as bar charts, by tag, with text labels on every bar; a streak or consistency read; empty state |

### 6.4 Web — Notes (2)

| # | Screen | Must show |
| --- | --- | --- |
| 15 | Notes list | Titles with a snippet and a timestamp, search or filter, paging, create entry, delete confirm, empty state |
| 16 | Note editor | Title, long body, save/cancel, validation errors, unsaved-changes handling |

### 6.5 Web — Budget (9)

| # | Screen | Must show |
| --- | --- | --- |
| 17 | Overview | Total balance plus per-account balances, this month's income and spend, cap meters, recent transactions, alerts for due or breached items, quick add |
| 18 | Accounts ("Cards") | Each account as a card — name, type, balance; create, rename, delete with confirm; empty state |
| 19 | Transfer | From-account, to-account, amount, date, note; insufficient-funds rejection; disabled state when the user has only one account |
| 20 | Transactions | A dense list or table — date, merchant, category, account, amount in or out, receipt indicator. **Show at least 20 rows.** Filters by date range, account, category, direction; paging; add; delete confirm; CSV export entry. This is the screen most likely to break at 375 px — show it there |
| 21 | Categories | The user's spending categories with colour or icon; create, rename, delete with confirm; first-use seeded set |
| 22 | Limits | A monthly cap per category — the cap, spent so far, remaining, a meter; over-cap treatment; create and edit; empty state |
| 23 | Goals | Savings goals as virtual jars — target, saved so far, progress, target date; contribute; complete state; empty state |
| 24 | Recurring | Scheduled repeating income and spend — amount, cadence, next date, account, category; due and overdue treatment; create, edit, delete confirm |
| 25 | Reports | Spend by category and by month, income versus spend, a period picker, and a chart style that belongs to the design system rather than a library default |

### 6.6 Web — Workout (7)

| # | Screen | Must show |
| --- | --- | --- |
| 26 | Today | The day's logged activity, the hourly nudge state, a one-line quick log, and the entry point to start a session from a routine |
| 27 | Live session / logging | **The most important screen in this module.** The current exercise, the set grid being filled in (set number, weight, reps, done), last time's numbers for comparison, a rest timer counting down, add-set, next-exercise, finish-session. Show it mid-workout, and design the rest-timer state |
| 28 | Exercise library | Searchable list of exercises by muscle group and equipment, with text instructions and cue list; create and edit a custom exercise; per-exercise history |
| 29 | Routines | Saved routines, the exercises and target sets in each, a builder for creating one, reorder, delete confirm, empty state |
| 30 | Sessions | Past workouts — date, duration, exercises, total volume — opening into a session's detail; paging; empty state |
| 31 | Body | Measurements over time (weight and tape sites) as a table and a trend, add a new entry, and **private progress photos** — handled so they never appear anywhere they could leak |
| 32 | Stats | Personal records per exercise, volume over time, and a consistency calendar; charts with text labels; empty state |

### 6.7 Web — Watch list and History (2)

| # | Screen | Must show |
| --- | --- | --- |
| 33 | Watch list | The user's lists and the items inside them — add a list, add an item, mark or remove, two levels of hierarchy on one screen, empty state at both levels |
| 34 | History | Recorded browsing history — title, URL, visit time — with paging, search, delete one, clear range, and the **retention rule** control (how long before URLs auto-delete) stated plainly |

### 6.8 Android (16)

Material 3, phone widths. Include the system bars. Also tell me whether to keep wallpaper-based dynamic colour or impose the brand palette — and show your answer.

| # | Screen | Must show |
| --- | --- | --- |
| 35 | Welcome / dashboard | The signed-in landing — live clock, cross-module summary, what is running |
| 36 | Sign in | Email, password, error state |
| 37 | Modules / home | How a person gets to six modules on a phone. Your navigation model — bottom bar, grid, or something else |
| 38 | Pomodoro | Full-screen countdown, phase, cycle position, controls |
| 39 | Preset dialog | Creating or editing a preset on a phone |
| 40 | Notes | List and editor |
| 41 | Budget | Balances, add a transaction, cap meters |
| 42 | Workout — today | Day's log and entry to a session |
| 43 | Workout — training | Live set logging with the rest timer, one-handed |
| 44 | Exercise library | Search and detail |
| 45 | Routine builder | Assembling a routine on a phone |
| 46 | Body | Measurements and private photos |
| 47 | Workout stats | Records, volume, consistency |
| 48 | Watch list | Lists and items |
| 49 | Settings | Appearance (system / light / dark), notifications, account, sign out |
| 50 | Sync prompt | The in-app prompt when local and server data need reconciling |

### 6.9 Browser extension — 380 px (12)

| # | Screen | Must show |
| --- | --- | --- |
| 51 | Popup shell | The tab or nav model across six modules in 380 px, plus a settings entry |
| 52 | Pomodoro | Running timer, start/stop, preset picker |
| 53 | Pomodoro preset | Editing a preset in a popup |
| 54 | Pomodoro analytics | A glanceable focus read at this width |
| 55 | Notes | Quick capture and recent notes |
| 56 | Budget | Quick expense — amount, account, category, date — plus this month's cap meters |
| 57 | Workout | Day's log and quick entry |
| 58 | Workout training | Live set logging in a popup |
| 59 | Watch list | Lists and quick add |
| 60 | History | Recent visits and the retention control |
| 61 | Options page | Full-page settings: server, permissions requested at point of use, blocked-site list, retention |
| 62 | Blocked page | The interstitial shown when strict mode blocks a site |

### 6.10 States that must be designed, not left to chance

Not separate pages necessarily — annotate them on the screens above, but every one has to be answered somewhere:

- **First run** — a brand-new account with nothing in any module.
- **Empty** — each list, each chart, each module with no data yet.
- **Loading** — page level and in-place.
- **Error** — a failed save, a failed load, offline.
- **Destructive confirm** — one accessible dialog pattern used everywhere.
- **Validation** — field-level errors and a form-level summary.
- **Success** — flashed confirmation after a save.
- **Focus** — visible on every interactive element, on every surface.
- **Capability differences** — each platform can honestly do different things: only the phone can silence notifications, only the extension can block sites, the web can only keep the screen awake and warn before you leave. Strict mode must read differently on each and must not imply a power it does not have.

## 7. Deliverable — what the PDFs must contain

**Format.** Three PDFs, one per option, named `jackandthings-option-{1,2,3}-{name}.pdf`, plus a fourth two-page PDF `jackandthings-recommendation.pdf` saying which you would ship and why. A3 landscape or 1920 × 1080 pt, screens at legible scale, text selectable rather than flattened, one screen per page unless a pair genuinely belongs together.

**Each option PDF, in this order:**

1. **Cover** — option name, one-line positioning.
2. **The argument** — one page. Who it is for, what it feels like, what it sacrifices, why it suits a suite that mixes focus, money and training.
3. **Information architecture** — a navigation map of what you propose: top-level, nested, merged, cut, and the mobile and popup equivalents. State explicitly how Home and Dashboard resolve.
4. **Palette** — light and dark, every value as hex, semantic roles named (background, surface, text, muted, accent, positive, negative, warning), with measured contrast ratios for text-on-background and accent-on-background, confirmed against AA.
5. **Typography** — faces with licensing noted, a scale with sizes, weights, line-heights and letter-spacing, and a specimen showing a heading, body, numerals and a dense table row.
6. **Scale and surfaces** — spacing scale, radii, borders, elevation and depth, iconography style and grid.
7. **Motion** — a written stance: what animates, what does not, durations and easings, and the `prefers-reduced-motion` answer. Annotated stills are fine; no video needed.
8. **Component kit** — buttons in every state (rest, hover, focus, active, disabled, loading), text input, select, textarea, checkbox, radio, toggle, slider, card, list row, table row, tabs or pills, modal, confirm dialog, toast, badge, chip, pagination, stat tile, meter or progress bar, chart styling, avatar, empty-state block, skeleton or loader.
9. **All 62 screens in section 6**, in the order given, light and dark, web screens at desktop and 375 px, annotated where behaviour is not obvious from the still.
10. **The hard case** — one page where you think the direction is under most pressure, and how you resolve it.
11. **What you would need from me** — open questions, assumptions you made, anything you deliberately left undesigned.

**Source files.** Keep the working file for all three; I will ask for the chosen one. At handover I will need a token table (names and values I can drop into code), exported SVG icons, and the font files or licence details.

## 8. Build constraints worth knowing

- Built by one developer. A direction that needs hand-engineering on every screen will lose to one that composes from a kit.
- Web is Tailwind, so a spacing and type scale that maps onto a utility system is cheaper to land. You are not obliged to it — just know the cost.
- Android is Material 3 with Compose. Say where you deliberately override the platform.
- The extension has no build step and no dependencies and must stay that way — plain CSS, plain DOM, no icon font, no framework, no runtime.
- Progress photos and receipts are private user images. No concept should put them anywhere they could leak — a notification, a thumbnail grid, a screenshot of another screen.
- Charts appear in four places (focus stats, budget reports, workout volume, cap meters). They are part of the design system, not a library drop-in, and every bar or point needs a text label because the chart alone conveys nothing to a screen reader.

## 9. Commercials and process

- **Fee:** propose. Section 6 is 62 screens in three directions — tell me what that costs, and if you think the right answer is fewer directions at full depth, or three directions with a staged screen rollout, make that case with numbers and I will consider it.
- **Timeline:** propose. I would rather have three convincing directions later than three thin ones sooner.
- **Check-in:** I am happy with one mid-point review on IA, palette and the component kit before you build out all 62 screens, if that saves you rework. I would encourage it.
- **Revisions:** state what is included.
- **IP:** full ownership of the chosen direction and its assets transfers to me on final payment; you keep portfolio rights.
- **Questions:** send them all at once, early. Anything in section 4 marked open is genuinely open — and if something marked fixed is blocking a good answer, say so rather than quietly working around it.

---

**Attachments:** logo vector master. Nothing else — see section 2.
