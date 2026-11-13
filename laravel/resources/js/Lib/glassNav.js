/**
 * Central nav config for the glass theme: the left module rail and each
 * module's top-right submenu. Submenu items are one of:
 *   - { type: 'anchor', target: 'overview' }   scrolls to #overview on the page
 *   - { type: 'link', target: 'notes.create' } navigates via an Inertia route name
 *   - { type: 'disabled' }                      shown greyed out, not interactive
 *
 * Pages pass only a `module` key to <AuthenticatedLayout>; GlassShell looks up
 * both the rail and the default submenu here. A page can still pass its own
 * `submenu` array (e.g. Budget disabling Transfer when there's only one
 * account) to override the default below for that render.
 */

export const MODULES = [
    {
        key: 'home',
        label: 'Home',
        route: 'home',
        match: 'home.*',
        icon: 'home',
    },
    {
        key: 'dashboard',
        label: 'Dashboard',
        route: 'dashboard',
        match: 'dashboard.*',
        icon: 'grid',
    },
    {
        key: 'pomodoro',
        label: 'Pomodoro',
        route: 'pomodoro.index',
        match: 'pomodoro.*',
        icon: 'clock',
    },
    {
        key: 'notes',
        label: 'Notes',
        route: 'notes.index',
        match: 'notes.*',
        icon: 'document',
    },
    {
        key: 'budget',
        label: 'Budget',
        route: 'budget.index',
        match: 'budget.*',
        icon: 'bars',
    },
    {
        key: 'workout',
        label: 'Workout',
        route: 'workouts.index',
        match: 'workouts.*',
        icon: 'heart',
    },
    {
        key: 'watchlist',
        label: 'Watch list',
        route: 'watchlist.index',
        match: 'watchlist.*',
        icon: 'list',
    },
    {
        key: 'history',
        label: 'History',
        route: 'history.index',
        match: 'history.*',
        icon: 'history',
    },
];

export const SUBMENUS = {
    pomodoro: [
        { label: 'Timer', type: 'link', target: 'pomodoro.index' },
        { label: 'Presets', type: 'link', target: 'pomodoro.presets' },
        { label: 'Sessions', type: 'link', target: 'pomodoro.sessions' },
        { label: 'Stats', type: 'link', target: 'pomodoro.stats' },
    ],
    budget: [
        { label: 'Overview', type: 'link', target: 'budget.index' },
        { label: 'Cards', type: 'link', target: 'budget.cards' },
        { label: 'Transfer', type: 'link', target: 'budget.transfer' },
        { label: 'Recurring', type: 'link', target: 'budget.recurring' },
        { label: 'Transactions', type: 'link', target: 'budget.transactions' },
    ],
    notes: [],
    // Six pages since issue #4, the same move Pomodoro made with issue #3:
    // an exercise library, a routine builder and a 90-day calendar do not fit
    // under one scroll bar, and scrolling past them to log a set is not a
    // workout tracker.
    workout: [
        { label: 'Today', type: 'link', target: 'workouts.index' },
        { label: 'Library', type: 'link', target: 'workouts.library' },
        { label: 'Routines', type: 'link', target: 'workouts.routines' },
        { label: 'Sessions', type: 'link', target: 'workouts.sessions' },
        { label: 'Body', type: 'link', target: 'workouts.body' },
        { label: 'Stats', type: 'link', target: 'workouts.stats' },
    ],
    watchlist: [
        { label: 'Lists', type: 'anchor', target: 'lists' },
        { label: 'Items', type: 'anchor', target: 'items' },
    ],
    history: [
        { label: 'Browsing', type: 'anchor', target: 'browsing' },
        { label: 'Retention', type: 'anchor', target: 'retention' },
    ],
};

export function getModule(key) {
    return MODULES.find((item) => item.key === key) ?? null;
}

export function getSubmenu(key) {
    return (SUBMENUS[key] ?? []).map((item) => ({ ...item }));
}

/**
 * For a module's secondary pages (e.g. Notes/Form, which has no #notes
 * anchor of its own) — turns every 'anchor' item into a 'link' back to the
 * index route, since there's nothing on this page to scroll to.
 */
export function getSubmenuForSecondaryPage(key, indexRoute) {
    return getSubmenu(key).map((item) =>
        item.type === 'anchor'
            ? { label: item.label, type: 'link', target: indexRoute }
            : item,
    );
}
