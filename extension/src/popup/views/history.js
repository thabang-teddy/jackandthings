import { api } from '../../lib/api.js';
import { ext, readSettings, writeSettings, hasPermission, requestPermission } from '../../lib/ext.js';
import { h, clear, muted, notice, guard } from '../../lib/dom.js';
import { formatWhen } from '../../lib/format.js';

/**
 * The history add-on.
 *
 * Two separate opt-ins, because they do very different things: recording
 * mirrors visited URLs to the server so they can be managed there, while
 * auto-delete removes them from the browser. Both need the optional `history`
 * permission, which is requested here rather than asked for at install time —
 * nobody installing this for the notes should have to hand over their
 * browsing history.
 */
export async function renderHistory(view, rerender) {
    clear(view).append(muted('Loading history…'));

    const settings = await readSettings();
    const granted = await hasPermission(['history']);

    let entries = [];
    let retentionDays = settings.retentionDays;
    try {
        const result = await api.historyEntries();
        entries = result.entries;
        if (Number.isFinite(result.retentionDays)) retentionDays = result.retentionDays;
    } catch (error) {
        clear(view).append(h('div', { class: 'alert', text: error.message }));
        return;
    }

    clear(view);

    if (!granted) {
        view.append(
            h('div', { class: 'card stack' }, [
                h('p', {
                    text: 'Reading and clearing browsing history needs an extra permission.',
                }),
                h('p', {
                    class: 'muted',
                    text: 'Nothing is recorded or deleted until you turn one of the switches on below.',
                }),
                h('button', {
                    class: 'btn',
                    type: 'button',
                    text: 'Grant history access',
                    onClick: () =>
                        guard(view, async () => {
                            await requestPermission(['history']);
                            await rerender();
                        }),
                }),
            ]),
        );
    }

    const toggle = (name, label, description, checked) =>
        h('div', { class: 'card' }, [
            h('div', { class: 'row' }, [
                h('div', { class: 'grow' }, [
                    h('strong', { text: label }),
                    h('div', { class: 'muted', text: description }),
                ]),
                h('input', {
                    type: 'checkbox',
                    name,
                    checked,
                    disabled: !granted,
                    style: 'width:auto',
                    onChange: (event) =>
                        guard(view, async () => {
                            await writeSettings({ [name]: event.target.checked });
                            await rerender();
                        }),
                }),
            ]),
        ]);

    view.append(
        toggle(
            'historyRecording',
            'Record visits',
            'Sends pages you visit to your server so they can be managed there.',
            settings.historyRecording,
        ),
        toggle(
            'historyAutoDelete',
            'Auto-delete old history',
            `Clears browser history older than ${retentionDays} days, once a day.`,
            settings.historyAutoDelete,
        ),
    );

    view.append(
        notice(
            `The ${retentionDays}-day window comes from the server, where it is still a ` +
                'placeholder rather than a settled rule.',
        ),
    );

    if (granted && settings.historyAutoDelete) {
        view.append(
            h('button', {
                class: 'btn-ghost',
                type: 'button',
                text: 'Clear matching history now',
                onClick: (event) =>
                    guard(view, async () => {
                        // Irreversible, and it is the browser's own history
                        // rather than this app's data, so it is confirmed.
                        const ok = window.confirm(
                            `Delete all browser history older than ${retentionDays} days? This cannot be undone.`,
                        );
                        if (!ok) return;
                        await ext.runtime.sendMessage({ type: 'prune-history-now' });
                        event.target.textContent = 'Cleared';
                    }),
            }),
        );
    }

    view.append(h('h2', { text: 'Recorded on the server' }));

    if (entries.length === 0) {
        view.append(muted('Nothing recorded yet.'));
        return;
    }

    for (const entry of entries.slice(0, 30)) {
        view.append(
            h('div', { class: 'card row' }, [
                h('div', { class: 'grow' }, [
                    h('strong', { class: 'truncate', text: entry.title || entry.url }),
                    h('div', { class: 'muted truncate', text: entry.url }),
                    h('div', {
                        class: 'muted',
                        text: [formatWhen(entry.visited_at), entry.source].filter(Boolean).join(' · '),
                    }),
                ]),
                h('button', {
                    class: 'btn-link btn-danger',
                    type: 'button',
                    text: 'Delete',
                    onClick: () =>
                        guard(view, async () => {
                            await api.deleteHistoryEntry(entry.id);
                            await rerender();
                        }),
                }),
            ]),
        );
    }
}
