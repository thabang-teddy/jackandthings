import { api } from '../../lib/api.js';
import { h, clear, muted, notice, guard } from '../../lib/dom.js';
import { formatWhen } from '../../lib/format.js';
import { renderTraining } from './workoutTraining.js';

/**
 * Workout in the popup: the quick one-line log, and a way through to the
 * tracked side.
 *
 * The sub-view is not registered in popup.js's VIEWS map - it is reached from
 * here, the way pomodoro.js reaches its preset form and its analytics. The tab
 * stays "Workout"; `options.tracking` decides which half is drawn, and it is
 * not persisted, so reopening the popup lands back on the quick log.
 */
export async function renderWorkout(view, rerender, options = {}) {
    if (options.tracking) {
        await renderTraining(view, rerender);
        return;
    }

    clear(view).append(muted('Loading workouts…'));

    const [entries, reminder] = await Promise.all([
        api.workoutEntries(),
        api.reminderState().catch(() => null),
    ]);

    clear(view);

    if (reminder?.due) {
        view.append(
            notice(
                reminder.last_logged_at
                    ? `Nothing logged this hour. Last: ${formatWhen(reminder.last_logged_at)}`
                    : 'Nothing logged this hour.',
            ),
        );
    }

    view.append(
        h('button', {
            class: 'btn-link',
            type: 'button',
            text: 'Track a workout →',
            onClick: () => rerender({ tracking: true }),
        }),
    );

    view.append(
        h('form', {
            class: 'card stack',
            onSubmit: (event) => {
                event.preventDefault();
                const form = event.target;
                const activity = form.elements.activity.value.trim();
                if (!activity) return;

                form.elements.save.disabled = true;
                guard(view, async () => {
                    await api.createWorkoutEntry(activity, form.elements.notes.value);
                    await rerender();
                });
            },
        }, [
            h('label', { text: 'Activity' }, [
                h('input', { name: 'activity', required: true, placeholder: '5km run, push-ups…' }),
            ]),
            h('label', { text: 'Notes (optional)' }, [h('input', { name: 'notes' })]),
            h('button', { class: 'btn', name: 'save', type: 'submit', text: 'Log it' }),
        ]),
    );

    if (entries.length === 0) {
        view.append(muted('No workouts logged.'));
        return;
    }

    for (const entry of entries) {
        view.append(
            h('div', { class: 'card' }, [
                h('div', { class: 'row' }, [
                    h('div', { class: 'grow' }, [
                        h('strong', { text: entry.activity }),
                        entry.notes ? h('div', { class: 'muted', text: entry.notes }) : null,
                        h('div', { class: 'muted', text: formatWhen(entry.logged_at) }),
                    ]),
                    h('button', {
                        class: 'btn-link btn-danger',
                        type: 'button',
                        text: 'Delete',
                        onClick: () =>
                            guard(view, async () => {
                                await api.deleteWorkoutEntry(entry.id);
                                await rerender();
                            }),
                    }),
                ]),
            ]),
        );
    }
}
