import { api } from '../../lib/api.js';
import { hasPermission, requestPermission } from '../../lib/ext.js';
import { h, clear, muted, guard } from '../../lib/dom.js';
import { formatWhen } from '../../lib/format.js';

const SOURCE = 'Browser add-on';

export async function renderClipboard(view, rerender) {
    clear(view).append(muted('Loading snippets…'));

    const items = await api.clipboardItems();
    clear(view);

    const contentField = h('textarea', { name: 'content', required: true });

    view.append(
        h('form', {
            class: 'card stack',
            onSubmit: (event) => {
                event.preventDefault();
                const form = event.target;
                const content = contentField.value;
                if (!content.trim()) return;

                form.elements.save.disabled = true;
                guard(view, async () => {
                    await api.createClipboardItem(
                        form.elements.title.value.trim(),
                        content,
                        SOURCE,
                    );
                    await rerender();
                });
            },
        }, [
            h('label', { text: 'Title (optional)' }, [h('input', { name: 'title' })]),
            h('label', { text: 'Content' }, [contentField]),
            h('div', { class: 'split' }, [
                h('button', { class: 'btn', name: 'save', type: 'submit', text: 'Save' }),
                h('button', {
                    class: 'btn-ghost',
                    type: 'button',
                    text: 'Paste',
                    // Reading the clipboard needs an optional permission in
                    // Chrome; ask only when the button is actually used.
                    onClick: () =>
                        guard(view, async () => {
                            if (!(await hasPermission(['clipboardRead']))) {
                                const granted = await requestPermission(['clipboardRead']);
                                if (!granted) return;
                            }
                            contentField.value = await navigator.clipboard.readText();
                        }),
                }),
            ]),
        ]),
    );

    if (items.length === 0) {
        view.append(muted('Nothing saved yet.'));
        return;
    }

    for (const item of items) {
        view.append(
            h('div', { class: 'card' }, [
                h('div', { class: 'row' }, [
                    h('div', { class: 'grow' }, [
                        item.title ? h('strong', { class: 'truncate', text: item.title }) : null,
                        h('div', { class: 'clamp', text: item.content }),
                        h('div', {
                            class: 'muted',
                            text: [item.source_device, formatWhen(item.created_at)]
                                .filter(Boolean)
                                .join(' · '),
                        }),
                    ]),
                    h('div', { class: 'stack' }, [
                        h('button', {
                            class: 'btn-link',
                            type: 'button',
                            text: 'Copy',
                            onClick: (event) =>
                                guard(view, async () => {
                                    await navigator.clipboard.writeText(item.content);
                                    event.target.textContent = 'Copied';
                                }),
                        }),
                        h('button', {
                            class: 'btn-link btn-danger',
                            type: 'button',
                            text: 'Delete',
                            onClick: () =>
                                guard(view, async () => {
                                    await api.deleteClipboardItem(item.id);
                                    await rerender();
                                }),
                        }),
                    ]),
                ]),
            ]),
        );
    }
}
