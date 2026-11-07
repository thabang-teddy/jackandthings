import { api } from '../lib/api.js';
import {
    readSettings,
    writeSettings,
    clearSession,
    ensureHostAccess,
    originPatternFor,
} from '../lib/ext.js';
import { h, clear, muted, alert as alertBox, guard } from '../lib/dom.js';

const root = document.getElementById('root');
const DEVICE_NAME = 'Browser add-on';

async function render() {
    const settings = await readSettings();
    clear(root);

    root.append(serverCard(settings));

    if (settings.token) {
        root.append(sessionCard(settings), preferencesCard(settings));
    } else {
        root.append(signInCard(settings));
    }
}

function serverCard(settings) {
    const input = h('input', { name: 'baseUrl', value: settings.baseUrl, required: true });

    return h('form', {
        class: 'card stack',
        onSubmit: (event) => {
            event.preventDefault();
            const value = input.value.trim();
            if (!value) return;

            guard(root, async () => {
                if (!originPatternFor(value)) {
                    throw new Error('That does not look like a URL.');
                }
                // The browser will not allow a cross-origin request to a host
                // the extension has no permission for, so ask before saving.
                const allowed = await ensureHostAccess(value);
                if (!allowed) {
                    throw new Error('Permission for that server was declined.');
                }
                await writeSettings({ baseUrl: value });
                await render();
            });
        },
    }, [
        h('strong', { text: 'Server' }),
        h('label', { text: 'API base URL' }, [input]),
        muted('Must end in /api/v1/ — for example http://127.0.0.1:8000/api/v1/'),
        h('button', { class: 'btn', type: 'submit', text: 'Save server' }),
    ]);
}

function signInCard() {
    return h('form', {
        class: 'card stack',
        onSubmit: (event) => {
            event.preventDefault();
            const form = event.target;
            const button = form.elements.submit;
            button.disabled = true;

            guard(root, async () => {
                try {
                    const payload = await api.signIn(
                        form.elements.email.value.trim(),
                        form.elements.password.value,
                        DEVICE_NAME,
                    );
                    await writeSettings({ token: payload.token, user: payload.user });
                    await render();
                } finally {
                    button.disabled = false;
                }
            });
        },
    }, [
        h('strong', { text: 'Sign in' }),
        h('label', { text: 'Email' }, [h('input', { name: 'email', type: 'email', required: true })]),
        h('label', { text: 'Password' }, [
            h('input', { name: 'password', type: 'password', required: true }),
        ]),
        h('button', { class: 'btn', name: 'submit', type: 'submit', text: 'Sign in' }),
    ]);
}

function sessionCard(settings) {
    return h('div', { class: 'card stack' }, [
        h('strong', { text: 'Signed in' }),
        muted(settings.user?.email ?? ''),
        h('button', {
            class: 'btn-ghost',
            type: 'button',
            text: 'Sign out',
            onClick: () =>
                guard(root, async () => {
                    // Cleared locally even if the server call fails: the user
                    // asked to sign out, and a dead network should not block it.
                    try {
                        await api.signOut();
                    } catch {
                        /* ignored on purpose */
                    }
                    await clearSession();
                    await render();
                }),
        }),
    ]);
}

function preferencesCard(settings) {
    const checkbox = (name, label, description, checked) =>
        h('div', { class: 'row', style: 'margin-top:8px' }, [
            h('div', { class: 'grow' }, [
                h('div', { text: label }),
                h('div', { class: 'muted', text: description }),
            ]),
            h('input', {
                type: 'checkbox',
                checked,
                style: 'width:auto',
                onChange: (event) =>
                    guard(root, async () => {
                        await writeSettings({ [name]: event.target.checked });
                    }),
            }),
        ]);

    return h('div', { class: 'card' }, [
        h('strong', { text: 'Preferences' }),
        checkbox(
            'remindersEnabled',
            'Hourly workout reminder',
            'Checks once an hour and notifies only when nothing is logged.',
            settings.remindersEnabled,
        ),
        h('p', { class: 'muted', style: 'margin-top:12px' }, [
            'History recording and auto-delete live in the popup’s History tab, ' +
                'because they need a separate browsing-history permission.',
        ]),
    ]);
}

render().catch((error) => {
    clear(root).append(alertBox(error?.message ?? 'Could not load settings.'));
});
