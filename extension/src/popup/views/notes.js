import { api } from '../../lib/api.js';
import { h, clear, muted, guard } from '../../lib/dom.js';
import { formatWhen } from '../../lib/format.js';

export async function renderNotes(view, rerender) {
    clear(view).append(muted('Loading notes…'));

    const notes = await api.notes();
    clear(view);

    view.append(
        h('form', {
            class: 'card stack',
            onSubmit: (event) => {
                event.preventDefault();
                const form = event.target;
                const title = form.elements.title.value.trim();
                if (!title) return;

                form.elements.save.disabled = true;
                guard(view, async () => {
                    await api.createNote(title, form.elements.body.value);
                    await rerender();
                });
            },
        }, [
            h('label', { text: 'Title' }, [h('input', { name: 'title', required: true })]),
            h('label', { text: 'Body' }, [h('textarea', { name: 'body' })]),
            h('button', { class: 'btn', name: 'save', type: 'submit', text: 'Add note' }),
        ]),
    );

    if (notes.length === 0) {
        view.append(muted('No notes yet.'));
        return;
    }

    for (const note of notes) {
        view.append(
            h('div', { class: 'card' }, [
                h('div', { class: 'row' }, [
                    h('div', { class: 'grow' }, [
                        h('strong', { class: 'truncate', text: note.title }),
                        note.body ? h('div', { class: 'clamp muted', text: note.body }) : null,
                        note.updated_at
                            ? h('div', { class: 'muted', text: formatWhen(note.updated_at) })
                            : null,
                    ]),
                    h('button', {
                        class: 'btn-link',
                        type: 'button',
                        text: note.is_starred ? '★' : '☆',
                        title: note.is_starred
                            ? 'Starred — shows on the home page'
                            : 'Star to pin to the home page',
                        'aria-pressed': String(Boolean(note.is_starred)),
                        onClick: () =>
                            guard(view, async () => {
                                await api.starNote(note.id, !note.is_starred);
                                await rerender();
                            }),
                    }),
                    h('button', {
                        class: 'btn-link btn-danger',
                        type: 'button',
                        text: 'Delete',
                        onClick: () =>
                            guard(view, async () => {
                                await api.deleteNote(note.id);
                                await rerender();
                            }),
                    }),
                ]),
            ]),
        );
    }
}
