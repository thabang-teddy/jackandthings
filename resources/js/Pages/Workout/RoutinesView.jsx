import { useMemo, useState } from 'react';
import { useForm } from '@inertiajs/react';
import GlassCard from '@/Components/Glass/GlassCard';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassSelect,
    GlassTextarea,
} from '@/Components/Glass/GlassFormControls';
import { gramsToKg, kgToGrams } from '@/Lib/formatWorkout';
import { fieldsFor } from '@/Lib/workoutProgress';

const BLANK_ITEM = {
    exercise_id: '',
    target_sets: 3,
    target_reps: '',
    target_weight_kg: '',
    target_distance_metres: '',
    target_duration_seconds: '',
    rest_seconds: 90,
};

/**
 * One exercise's row in the routine being built.
 *
 * Which target inputs it offers comes from the exercise's metric through the
 * shared `fieldsFor()` rule, so a routine cannot be given a target weight for
 * a plank - the server would reject it and the user would have no idea why.
 */
function ItemEditor({
    item,
    index,
    exercises,
    errors,
    onChange,
    onRemove,
    onMove,
    isLast,
}) {
    const exercise =
        exercises.find((option) => option.id === item.exercise_id) ?? null;

    // Before an exercise is chosen there is nothing to say which measures
    // apply, and offering all four reads as clutter rather than as choice.
    // Sets and rest are the two that always apply.
    const fields = exercise
        ? fieldsFor(exercise.metric)
        : { weight: false, reps: false, distance: false, duration: false };

    const set = (field, value) => onChange(index, { ...item, [field]: value });

    return (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
            <div className="mb-2 flex items-center gap-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    {index + 1}
                </span>
                <GlassSelect
                    value={item.exercise_id}
                    onChange={(event) => set('exercise_id', event.target.value)}
                    aria-label={`Exercise ${index + 1}`}
                    required
                >
                    <option value="">Pick an exercise…</option>
                    {exercises.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.name}
                        </option>
                    ))}
                </GlassSelect>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onMove(index, -1)}
                        disabled={index === 0}
                        aria-label="Move up"
                        className="rounded-full border border-[var(--card-border)] px-2 py-1 text-xs text-[var(--muted)] disabled:opacity-30"
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove(index, 1)}
                        disabled={isLast}
                        aria-label="Move down"
                        className="rounded-full border border-[var(--card-border)] px-2 py-1 text-xs text-[var(--muted)] disabled:opacity-30"
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        onClick={() => onRemove(index)}
                        aria-label="Remove exercise"
                        className="rounded-full border border-[var(--card-border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--neg)]"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <GlassError message={errors[`items.${index}.exercise_id`]} />

            <div className="grid gap-2 sm:grid-cols-4">
                <div>
                    <GlassLabel htmlFor={`item_sets_${index}`}>Sets</GlassLabel>
                    <GlassInput
                        id={`item_sets_${index}`}
                        type="number"
                        min="1"
                        value={item.target_sets}
                        onChange={(event) =>
                            set('target_sets', event.target.value)
                        }
                    />
                </div>

                {fields.reps && (
                    <div>
                        <GlassLabel htmlFor={`item_reps_${index}`}>
                            Reps
                        </GlassLabel>
                        <GlassInput
                            id={`item_reps_${index}`}
                            type="number"
                            min="1"
                            value={item.target_reps}
                            onChange={(event) =>
                                set('target_reps', event.target.value)
                            }
                        />
                    </div>
                )}

                {fields.weight && (
                    <div>
                        <GlassLabel htmlFor={`item_weight_${index}`}>
                            kg
                        </GlassLabel>
                        <GlassInput
                            id={`item_weight_${index}`}
                            type="number"
                            step="0.5"
                            min="0"
                            value={item.target_weight_kg}
                            onChange={(event) =>
                                set('target_weight_kg', event.target.value)
                            }
                        />
                    </div>
                )}

                {fields.distance && (
                    <div>
                        <GlassLabel htmlFor={`item_distance_${index}`}>
                            Metres
                        </GlassLabel>
                        <GlassInput
                            id={`item_distance_${index}`}
                            type="number"
                            min="0"
                            value={item.target_distance_metres}
                            onChange={(event) =>
                                set(
                                    'target_distance_metres',
                                    event.target.value,
                                )
                            }
                        />
                    </div>
                )}

                {fields.duration && (
                    <div>
                        <GlassLabel htmlFor={`item_duration_${index}`}>
                            Seconds
                        </GlassLabel>
                        <GlassInput
                            id={`item_duration_${index}`}
                            type="number"
                            min="0"
                            value={item.target_duration_seconds}
                            onChange={(event) =>
                                set(
                                    'target_duration_seconds',
                                    event.target.value,
                                )
                            }
                        />
                    </div>
                )}

                <div>
                    <GlassLabel htmlFor={`item_rest_${index}`}>
                        Rest (s)
                    </GlassLabel>
                    <GlassInput
                        id={`item_rest_${index}`}
                        type="number"
                        min="0"
                        value={item.rest_seconds}
                        onChange={(event) =>
                            set('rest_seconds', event.target.value)
                        }
                    />
                </div>
            </div>
        </div>
    );
}

export default function WorkoutRoutinesView({ routines, exercises, onDelete }) {
    const [editing, setEditing] = useState(null);
    const [items, setItems] = useState([{ ...BLANK_ITEM }]);

    const { data, setData, post, put, processing, errors, reset, transform } =
        useForm({
            name: '',
            notes: '',
        });

    const itemErrors = useMemo(() => errors ?? {}, [errors]);

    const startEdit = (routine) => {
        setEditing(routine);
        setData({ name: routine.name, notes: routine.notes ?? '' });
        setItems(
            routine.items.map((item) => ({
                exercise_id: item.exercise_id,
                target_sets: item.target_sets ?? 3,
                target_reps: item.target_reps ?? '',
                target_weight_kg: gramsToKg(item.target_weight_grams),
                target_distance_metres: item.target_distance_metres ?? '',
                target_duration_seconds: item.target_duration_seconds ?? '',
                rest_seconds: item.rest_seconds ?? 90,
            })),
        );
    };

    const startNew = () => {
        setEditing(null);
        reset();
        setItems([{ ...BLANK_ITEM }]);
    };

    const changeItem = (index, next) =>
        setItems((current) =>
            current.map((item, at) => (at === index ? next : item)),
        );

    const removeItem = (index) =>
        setItems((current) =>
            current.length === 1
                ? current
                : current.filter((_, at) => at !== index),
        );

    const moveItem = (index, delta) =>
        setItems((current) => {
            const target = index + delta;

            if (target < 0 || target >= current.length) {
                return current;
            }

            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];

            return next;
        });

    const submit = (event) => {
        event.preventDefault();

        // The array order is the user's chosen order; the server assigns
        // `position` from it, so nothing here sends one.
        transform((payload) => ({
            ...payload,
            items: items
                .filter((item) => item.exercise_id)
                .map((item) => ({
                    exercise_id: item.exercise_id,
                    target_sets: blankToNull(item.target_sets),
                    target_reps: blankToNull(item.target_reps),
                    target_weight_grams: kgToGrams(item.target_weight_kg),
                    target_distance_metres: blankToNull(
                        item.target_distance_metres,
                    ),
                    target_duration_seconds: blankToNull(
                        item.target_duration_seconds,
                    ),
                    rest_seconds: blankToNull(item.rest_seconds),
                })),
        }));

        const options = {
            preserveScroll: true,
            onSuccess: () => startNew(),
        };

        if (editing) {
            put(route('workouts.routines.update', editing.id), options);
        } else {
            post(route('workouts.routines.store'), options);
        }
    };

    return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-2">
            <GlassCard
                title={`Routines (${routines.length})`}
                className="flex min-h-0 flex-col"
                action={
                    <button
                        type="button"
                        onClick={startNew}
                        className="rounded-full border border-[var(--card-border)] px-3 py-1 text-[11px] font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]"
                    >
                        New
                    </button>
                }
            >
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                    {routines.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">
                            A routine is an ordered list of exercises with
                            targets — Push day, Full body, 5K prep. Build one
                            and it drives the targets and the rest timer during
                            a workout.
                        </p>
                    ) : (
                        routines.map((routine) => (
                            <div
                                key={routine.id}
                                className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2.5"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-[var(--ink)]">
                                            {routine.name}
                                        </p>
                                        <p className="text-xs text-[var(--muted)]">
                                            {routine.items.length} exercise
                                            {routine.items.length === 1
                                                ? ''
                                                : 's'}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => startEdit(routine)}
                                            className="text-[#8BB4FF] hover:underline"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDelete(routine)}
                                            className="text-[var(--muted)] hover:text-[var(--neg)]"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                <ol className="mt-2 space-y-0.5 text-xs text-[var(--muted)]">
                                    {routine.items.map((item) => (
                                        <li key={item.id}>
                                            {item.exercise_name}
                                            {item.target_sets
                                                ? ` — ${item.target_sets} × ${item.target_reps ?? '—'}`
                                                : ''}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        ))
                    )}
                </div>
            </GlassCard>

            <GlassCard
                title={editing ? `Editing ${editing.name}` : 'Build a routine'}
                className="min-h-0 overflow-y-auto"
            >
                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <GlassLabel htmlFor="routine_name">Name</GlassLabel>
                        <GlassInput
                            id="routine_name"
                            value={data.name}
                            onChange={(event) =>
                                setData('name', event.target.value)
                            }
                            placeholder="Push day"
                            required
                        />
                        <GlassError message={errors.name} />
                    </div>

                    <div>
                        <GlassLabel htmlFor="routine_notes">Notes</GlassLabel>
                        <GlassTextarea
                            id="routine_notes"
                            rows={2}
                            value={data.notes}
                            onChange={(event) =>
                                setData('notes', event.target.value)
                            }
                        />
                        <GlassError message={errors.notes} />
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                            Exercises
                        </p>
                        {items.map((item, index) => (
                            <ItemEditor
                                key={index}
                                item={item}
                                index={index}
                                exercises={exercises}
                                errors={itemErrors}
                                onChange={changeItem}
                                onRemove={removeItem}
                                onMove={moveItem}
                                isLast={index === items.length - 1}
                            />
                        ))}
                        <GlassError message={errors.items} />
                        <button
                            type="button"
                            onClick={() =>
                                setItems((current) => [
                                    ...current,
                                    { ...BLANK_ITEM },
                                ])
                            }
                            className="rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]"
                        >
                            + Add exercise
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <GlassButton type="submit" disabled={processing}>
                            {editing ? 'Save routine' : 'Create routine'}
                        </GlassButton>
                        {editing && (
                            <button
                                type="button"
                                onClick={startNew}
                                className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </GlassCard>
        </div>
    );
}

function blankToNull(value) {
    return value === '' || value === null || value === undefined
        ? null
        : Number(value);
}
