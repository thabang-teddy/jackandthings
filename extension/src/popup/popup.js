import { ext, readSettings } from '../lib/ext.js';
import { h, clear, muted } from '../lib/dom.js';
import { renderPomodoro } from './views/pomodoro.js';
import { renderNotes } from './views/notes.js';
import { renderBudget } from './views/budget.js';
import { renderWorkout } from './views/workout.js';
import { renderWatchList } from './views/watchlist.js';
import { renderHistory } from './views/history.js';

const VIEWS = {
    pomodoro: renderPomodoro,
    notes: renderNotes,
    budget: renderBudget,
    workout: renderWorkout,
    watchlist: renderWatchList,
    history: renderHistory,
};

const LAST_VIEW_KEY = 'lastView';

const view = document.getElementById('view');
const tabs = document.getElementById('tabs');

document.getElementById('settings').addEventListener('click', () => {
    ext.runtime.openOptionsPage();
});

function showSignedOut() {
    tabs.hidden = true;
    clear(view).append(
        h('div', { class: 'card stack' }, [
            h('strong', { text: 'Not signed in' }),
            muted('Connect this browser to your Jack & Things server to get started.'),
            h('button', {
                class: 'btn',
                type: 'button',
                text: 'Open settings',
                onClick: () => ext.runtime.openOptionsPage(),
            }),
        ]),
    );
}

async function show(name) {
    const render = VIEWS[name] ?? renderPomodoro;

    for (const tab of tabs.querySelectorAll('.tab')) {
        tab.setAttribute('aria-selected', String(tab.dataset.view === name));
    }
    await ext.storage.local.set({ [LAST_VIEW_KEY]: name });

    try {
        await render(view, () => show(name));
    } catch (error) {
        clear(view).append(
            h('div', { class: 'alert', text: error?.message ?? 'Something went wrong.' }),
        );
    }
}

tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (tab) show(tab.dataset.view);
});

async function start() {
    const { token } = await readSettings();
    if (!token) {
        showSignedOut();
        return;
    }

    tabs.hidden = false;
    const stored = await ext.storage.local.get(LAST_VIEW_KEY);
    await show(stored[LAST_VIEW_KEY] ?? 'pomodoro');
}

start();
