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
        { label: 'Timer', type: 'anchor', target: 'timer' },
        { label: 'Presets', type: 'anchor', target: 'presets' },
        { label: 'Sessions', type: 'disabled' },
        { label: 'Stats', type: 'disabled' },
    ],
    budget: [
        { label: 'Overview', type: 'link', target: 'budget.index' },
        { label: 'Cards', type: 'link', target: 'budget.cards' },
        { label: 'Transfer', type: 'link', target: 'budget.transfer' },
        { label: 'Recurring', type: 'link', target: 'budget.recurring' },
        { label: 'Transactions', type: 'link', target: 'budget.transactions' },
    ],
    notes: [
        { label: 'All Notes', type: 'anchor', target: 'notes' },
        { label: 'New Note', type: 'anchor', target: 'note-form' },
    ],
    workout: [
        { label: 'Overview', type: 'anchor', target: 'overview' },
        { label: 'Log entry', type: 'link', target: 'workouts.create' },
        { label: 'Presets', type: 'anchor', target: 'presets' },
        { label: 'Reminders', type: 'anchor', target: 'reminders' },
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
