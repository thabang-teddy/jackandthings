import { api } from '../../lib/api.js';
import { h, clear, muted, guard } from '../../lib/dom.js';

/**
 * Watch list: the user's named lists, each holding items. Mirrors the web
 * app's grouped structure over the same api/v1 contract.
 */
export async function renderWatchList(view, rerender) {
    clear(view).append(muted('Loading lists…'));

    const lists = await api.watchLists();
    clear(view);

    const nameField = h('input', { name: 'name', required: true });

    view.append(
        h('form', {
            class: 'card stack',
            onSubmit: (event) => {
                event.preventDefault();
                const form = event.target;
                const name = nameField.value.trim();
                if (!name) return;

                form.elements.save.disabled = true;
                guard(view, async () => {
                    await api.createWatchList(name);
                    await rerender();
                });
            },
        }, [
            h('label', { text: 'New list' }, [nameField]),
            h('button', { class: 'btn', name: 'save', type: 'submit', text: 'Create list' }),
        ]),
    );

    if (lists.length === 0) {
        view.append(muted('No lists yet.'));
        return;
    }

    for (const list of lists) {
        const titleField = h('input', { name: 'title', required: true });

        view.append(
            h('div', { class: 'card stack' }, [
                h('div', { class: 'row' }, [
                    h('strong', { class: 'grow truncate', text: list.name }),
                    h('button', {
                        class: 'btn-link btn-danger',
                        type: 'button',
                        text: 'Delete list',
                        onClick: () =>
                            guard(view, async () => {
                                await api.deleteWatchList(list.id);
                                await rerender();
                            }),
                    }),
                ]),
                h('form', {
                    class: 'split',
                    onSubmit: (event) => {
                        event.preventDefault();
                        const title = titleField.value.trim();
                        if (!title) return;
                        guard(view, async () => {
                            await api.createWatchListItem(list.id, title);
                            await rerender();
                        });
                    },
                }, [
                    titleField,
                    h('button', { class: 'btn', type: 'submit', text: 'Add' }),
                ]),
                ...(list.items ?? []).map((item) =>
                    h('div', { class: 'row' }, [
                        h('div', {
                            class: 'grow truncate',
                            text: item.title,
                            style: item.done ? 'text-decoration: line-through; opacity: 0.6' : '',
                        }),
                        h('button', {
                            class: 'btn-link',
                            type: 'button',
                            text: item.done ? 'Undo' : 'Done',
                            onClick: () =>
                                guard(view, async () => {
                                    await api.updateWatchListItem(item.id, { done: !item.done });
                                    await rerender();
                                }),
                        }),
                        h('button', {
                            class: 'btn-link btn-danger',
                            type: 'button',
                            text: 'Delete',
                            onClick: () =>
                                guard(view, async () => {
                                    await api.deleteWatchListItem(item.id);
                                    await rerender();
                                }),
                        }),
                    ]),
                ),
            ]),
        );
    }
}
