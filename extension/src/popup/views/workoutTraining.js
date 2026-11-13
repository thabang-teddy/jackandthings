import { api } from '../../lib/api.js';
import { ext, readSettings } from '../../lib/ext.js';
import { h, clear, muted, notice, guard } from '../../lib/dom.js';
import { formatWhen } from '../../lib/format.js';
import { fieldsFor, nextSet, restSecondsFor, routineProgress } from '../../lib/workoutProgress.js';

/**
 * The tracked half of Workout in the popup: start a workout from a routine,
 * log sets into it, see what the routine says to do next, and rest.
 *
 * Deliberately narrower than the web app and the phone. Building a routine and
 * keeping body metrics are not popup work - a 400px panel is not where you
 * plan a training block or type seven tape measurements - so those stay where
 * there is room for them. What a popup is good for is the thing you do between
 * sets with one hand, which is this.
 *
 * Progress photos are absent entirely: a popup is the wrong place to upload a
 * photograph of yourself, and it would need a host permission the add-on does
 * not otherwise ask for.
 */
export async function renderTraining(view, rerender) {
    clear(view).append(muted('Loading workout…'));

    const [session, routines, exercises, settings] = await Promise.all([
        api.currentWorkoutSession().catch(() => null),
        api.workoutRoutines().catch(() => []),
        api.exercises().catch(() => []),
        readSettings(),
    ]);

    clear(view);

    view.append(
        h('button', {
            class: 'btn-link',
            type: 'button',
            text: '← Quick log',
            onClick: () => rerender({ tracking: false }),
        }),
    );

    if (!session) {
        view.append(renderStart(view, routines, rerender));
        return;
    }

    const routine = routines.find((item) => item.id === session.workout_routine_id) ?? null;
    const suggestion = routine ? nextSet(routine.items, session.sets) : null;
    const progress = routine ? routineProgress(routine.items, session.sets) : null;

    view.append(renderSessionCard(view, session, suggestion, progress, rerender));

    const rest = settings.workoutRest;
    if (rest?.endsAt && rest.endsAt > Date.now()) {
        view.append(renderRest(view, rest, rerender));
    }

    view.append(renderSetForm(view, session, exercises, suggestion, rerender));

    if (session.sets.length === 0) {
        view.append(muted('No sets logged yet.'));
        return;
    }

    for (const set of [...session.sets].reverse()) {
        view.append(
            h('div', { class: 'card' }, [
                h('div', { class: 'row' }, [
                    h('div', { class: 'grow' }, [
                        h('strong', { text: set.exercise_name ?? 'Exercise' }),
                        h('div', {
                            class: 'muted',
                            text: (set.is_warmup ? 'Warm-up · ' : '') + describeSet(set),
                        }),
                    ]),
                    h('button', {
                        class: 'btn-link btn-danger',
                        type: 'button',
                        text: 'Remove',
                        onClick: () =>
                            guard(view, async () => {
                                await api.deleteWorkoutSet(set.id);
                                await rerender({ tracking: true });
                            }),
                    }),
                ]),
            ]),
        );
    }
}

function renderStart(view, routines, rerender) {
    return h(
        'form',
        {
            class: 'card stack',
            onSubmit: (event) => {
                event.preventDefault();
                const routineId = event.target.elements.routine.value || null;

                event.target.elements.start.disabled = true;
                guard(view, async () => {
                    await api.startWorkoutSession(routineId);
                    await rerender({ tracking: true });
                });
            },
        },
        [
            h('strong', { text: 'Start a tracked workout' }),
            h('label', { text: 'Routine' }, [
                h('select', { name: 'routine' }, [
                    // Freestyle is a real workout; refusing to track one
                    // would make this a worse tracker, not a simpler one.
                    h('option', { value: '', text: 'No routine - freestyle' }),
                    ...routines.map((routine) =>
                        h('option', { value: routine.id, text: routine.name }),
                    ),
                ]),
            ]),
            h('button', { class: 'btn', name: 'start', type: 'submit', text: 'Start' }),
            routines.length === 0
                ? muted('No routines yet - build one in the web app to get targets and rest times.')
                : null,
        ],
    );
}

function renderSessionCard(view, session, suggestion, progress, rerender) {
    return h('div', { class: 'card stack' }, [
        h('div', { class: 'row' }, [
            h('div', { class: 'grow' }, [
                h('strong', { text: session.routine_name ?? 'Freestyle workout' }),
                h('div', {
                    class: 'muted',
                    text: [
                        `${session.set_count} set${session.set_count === 1 ? '' : 's'}`,
                        progress ? `routine ${progress.done} of ${progress.target}` : null,
                        session.started_at ? formatWhen(session.started_at) : null,
                    ]
                        .filter(Boolean)
                        .join(' · '),
                }),
            ]),
            h('button', {
                class: 'btn-link',
                type: 'button',
                text: 'Finish',
                onClick: () =>
                    guard(view, async () => {
                        await api.finishWorkoutSession(session.id);
                        await ext.runtime.sendMessage({ type: 'cancel-rest' });
                        await rerender({ tracking: true });
                    }),
            }),
        ]),
        suggestion
            ? h('div', {
                  text:
                      `Up next: ${suggestion.item.exercise_name} - set ` +
                      `${suggestion.setNumber} of ${suggestion.targetSets}` +
                      (suggestion.item.target_reps
                          ? `, target ${suggestion.item.target_reps} reps`
                          : ''),
              })
            : null,
    ]);
}

function renderRest(view, rest, rerender) {
    const secondsLeft = Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000));

    return h('div', { class: 'card stack' }, [
        h('strong', { text: `Resting ${formatClock(secondsLeft)}` }),
        rest.label ? muted(`Next: ${rest.label}`) : null,
        h('div', { class: 'row' }, [
            h('button', {
                class: 'btn-link',
                type: 'button',
                text: 'Skip',
                onClick: () =>
                    guard(view, async () => {
                        await ext.runtime.sendMessage({ type: 'cancel-rest' });
                        await rerender({ tracking: true });
                    }),
            }),
        ]),
        // The alarm, not this panel, is what ends the rest: the popup is shut
        // for nearly all of one, so the clock here is a snapshot rather than a
        // countdown.
        muted('The notification arrives even with this popup closed.'),
    ]);
}

function renderSetForm(view, session, exercises, suggestion, rerender) {
    const selectedId = suggestion?.exercise_id ?? exercises[0]?.id ?? '';
    const selected = exercises.find((item) => item.id === selectedId) ?? null;
    const fields = fieldsFor(selected?.metric);

    return h(
        'form',
        {
            class: 'card stack',
            onSubmit: (event) => {
                event.preventDefault();
                const form = event.target;
                const exerciseId = form.elements.exercise.value;
                if (!exerciseId) return;

                form.elements.save.disabled = true;

                guard(view, async () => {
                    const reply = await api.logWorkoutSet(session.id, {
                        exercise_id: exerciseId,
                        is_warmup: form.elements.warmup.checked,
                        reps: numberOrNull(form.elements.reps?.value),
                        weight_grams: kgToGrams(form.elements.weight?.value),
                        distance_metres: numberOrNull(form.elements.distance?.value),
                        duration_seconds: numberOrNull(form.elements.duration?.value),
                    });

                    const seconds = restSecondsFor(suggestion?.item);
                    await ext.runtime.sendMessage({
                        type: 'start-rest',
                        seconds,
                        label: suggestion?.item?.exercise_name ?? selected?.name ?? null,
                    });

                    if (reply?.is_record) {
                        view.prepend(notice('New personal record.'));
                    }

                    await rerender({ tracking: true });
                });
            },
        },
        [
            h('strong', { text: 'Log a set' }),
            h('label', { text: 'Exercise' }, [
                h(
                    'select',
                    { name: 'exercise', required: true },
                    exercises.map((item) =>
                        h('option', {
                            value: item.id,
                            text: item.name,
                            selected: item.id === selectedId,
                        }),
                    ),
                ),
            ]),
            // Which inputs appear comes from the exercise's metric through the
            // shared rule, so a plank is never asked for a weight.
            fields.weight
                ? h('label', { text: 'Weight (kg)' }, [
                      h('input', { name: 'weight', type: 'number', step: '0.5', min: '0' }),
                  ])
                : null,
            fields.reps
                ? h('label', { text: 'Reps' }, [
                      h('input', { name: 'reps', type: 'number', min: '1' }),
                  ])
                : null,
            fields.distance
                ? h('label', { text: 'Distance (m)' }, [
                      h('input', { name: 'distance', type: 'number', min: '0' }),
                  ])
                : null,
            fields.duration
                ? h('label', { text: 'Time (seconds)' }, [
                      h('input', { name: 'duration', type: 'number', min: '0' }),
                  ])
                : null,
            h('label', { class: 'row', text: 'Warm-up' }, [
                h('input', { name: 'warmup', type: 'checkbox' }),
            ]),
            h('button', { class: 'btn', name: 'save', type: 'submit', text: 'Log set' }),
        ],
    );
}

function describeSet(set) {
    const parts = [];
    const weight = set.weight_grams != null ? `${set.weight_grams / 1000} kg` : null;

    if (weight && set.reps) parts.push(`${weight} x ${set.reps}`);
    else if (weight) parts.push(weight);
    else if (set.reps) parts.push(`${set.reps} reps`);

    if (set.distance_metres) parts.push(`${set.distance_metres} m`);
    if (set.duration_seconds) parts.push(formatClock(set.duration_seconds));

    return parts.length > 0 ? parts.join(' · ') : '-';
}

function formatClock(seconds) {
    const minutes = Math.floor(seconds / 60);

    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function numberOrNull(value) {
    if (value === undefined || value === null || value === '') return null;

    const number = Number(value);

    return Number.isFinite(number) ? Math.round(number) : null;
}

function kgToGrams(value) {
    if (value === undefined || value === null || value === '') return null;

    const number = Number(value);

    return Number.isFinite(number) ? Math.round(number * 1000) : null;
}
