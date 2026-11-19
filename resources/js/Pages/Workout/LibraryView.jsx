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

const BLANK = {
    name: '',
    category: 'strength',
    metric: 'weight_reps',
    primary_muscle: '',
    equipment: '',
    instructions: '',
    cues: '',
};

/**
 * One exercise, expanded to show its instructions and cues.
 *
 * The catalog rows carry no images - "form demonstrations" ship as written
 * instructions and a cue list, the same call the project makes with
 * synthesised rather than sampled Pomodoro sounds. A built-in exercise shows
 * no edit controls because nobody may change one: it is shared by everybody.
 */
function ExerciseRow({ exercise, expanded, onToggle, onEdit, onDelete }) {
    return (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
            >
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">
                        {exercise.name}
                        {exercise.is_custom && (
                            <span className="ml-2 rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                                Yours
                            </span>
                        )}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                        {[
                            exercise.category_label,
                            exercise.primary_muscle,
                            exercise.equipment,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                    {expanded ? 'Hide' : 'Show'}
                </span>
            </button>

            {expanded && (
                <div className="border-t border-[var(--card-border)] px-3 py-3">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                        Tracks
                    </p>
                    <p className="mb-3 text-sm text-[var(--ink)]">
                        {exercise.metric_label}
                    </p>

                    {exercise.instructions && (
                        <>
                            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                                How
                            </p>
                            <p className="mb-3 whitespace-pre-line text-sm text-[var(--ink)]">
                                {exercise.instructions}
                            </p>
                        </>
                    )}

                    {exercise.cues?.length > 0 && (
                        <>
                            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                                Cues
                            </p>
                            <ul className="mb-1 list-disc space-y-1 pl-5 text-sm text-[var(--ink)]">
                                {exercise.cues.map((cue) => (
                                    <li key={cue}>{cue}</li>
                                ))}
                            </ul>
                        </>
                    )}

                    {exercise.is_custom && (
                        <div className="mt-3 flex items-center gap-3 text-xs">
                            <button
                                type="button"
                                onClick={() => onEdit(exercise)}
                                className="text-[#8BB4FF] hover:underline"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                onClick={() => onDelete(exercise)}
                                className="text-[var(--muted)] hover:text-[var(--neg)]"
                            >
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function WorkoutLibraryView({
    exercises,
    categories,
    metrics,
    onDelete,
}) {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [editing, setEditing] = useState(null);

    const { data, setData, post, put, processing, errors, reset, transform } =
        useForm(BLANK);

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();

        return exercises.filter((exercise) => {
            if (category && exercise.category !== category) {
                return false;
            }

            if (!needle) {
                return true;
            }

            return [exercise.name, exercise.primary_muscle, exercise.equipment]
                .filter(Boolean)
                .some((field) => field.toLowerCase().includes(needle));
        });
    }, [exercises, search, category]);

    const startEdit = (exercise) => {
        setEditing(exercise);
        setData({
            name: exercise.name,
            category: exercise.category,
            metric: exercise.metric,
            primary_muscle: exercise.primary_muscle ?? '',
            equipment: exercise.equipment ?? '',
            instructions: exercise.instructions ?? '',
            // One cue per line in the form; an array on the wire.
            cues: (exercise.cues ?? []).join('\n'),
        });
    };

    const cancelEdit = () => {
        setEditing(null);
        reset();
    };

    const submit = (event) => {
        event.preventDefault();

        transform((payload) => ({
            ...payload,
            cues: payload.cues
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
        }));

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setEditing(null);
                reset();
            },
        };

        if (editing) {
            put(route('workouts.exercises.update', editing.id), options);
        } else {
            post(route('workouts.exercises.store'), options);
        }
    };

    return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-2">
            <GlassCard
                title={`Exercises (${visible.length})`}
                className="flex min-h-0 flex-col"
            >
                <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <GlassInput
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search name, muscle or kit…"
                        aria-label="Search exercises"
                    />
                    <GlassSelect
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        aria-label="Filter by category"
                    >
                        <option value="">All categories</option>
                        {categories.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </GlassSelect>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                    {visible.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">
                            Nothing matches that. Clear the filters, or add it
                            as your own exercise.
                        </p>
                    ) : (
                        visible.map((exercise) => (
                            <ExerciseRow
                                key={exercise.id}
                                exercise={exercise}
                                expanded={expandedId === exercise.id}
                                onToggle={() =>
                                    setExpandedId(
                                        expandedId === exercise.id
                                            ? null
                                            : exercise.id,
                                    )
                                }
                                onEdit={startEdit}
                                onDelete={onDelete}
                            />
                        ))
                    )}
                </div>
            </GlassCard>

            <GlassCard
                title={
                    editing
                        ? `Editing ${editing.name}`
                        : 'Add your own exercise'
                }
                className="min-h-0 overflow-y-auto"
            >
                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <GlassLabel htmlFor="exercise_name">Name</GlassLabel>
                        <GlassInput
                            id="exercise_name"
                            value={data.name}
                            onChange={(event) =>
                                setData('name', event.target.value)
                            }
                            placeholder="Trap bar deadlift"
                            required
                        />
                        <GlassError message={errors.name} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <GlassLabel htmlFor="exercise_category">
                                Category
                            </GlassLabel>
                            <GlassSelect
                                id="exercise_category"
                                value={data.category}
                                onChange={(event) =>
                                    setData('category', event.target.value)
                                }
                            >
                                {categories.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </GlassSelect>
                            <GlassError message={errors.category} />
                        </div>
                        <div>
                            <GlassLabel htmlFor="exercise_metric">
                                Tracks
                            </GlassLabel>
                            <GlassSelect
                                id="exercise_metric"
                                value={data.metric}
                                onChange={(event) =>
                                    setData('metric', event.target.value)
                                }
                            >
                                {metrics.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </GlassSelect>
                            <GlassError message={errors.metric} />
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <GlassLabel htmlFor="exercise_muscle">
                                Main muscle
                            </GlassLabel>
                            <GlassInput
                                id="exercise_muscle"
                                value={data.primary_muscle}
                                onChange={(event) =>
                                    setData(
                                        'primary_muscle',
                                        event.target.value,
                                    )
                                }
                                placeholder="Hamstrings"
                            />
                            <GlassError message={errors.primary_muscle} />
                        </div>
                        <div>
                            <GlassLabel htmlFor="exercise_equipment">
                                Equipment
                            </GlassLabel>
                            <GlassInput
                                id="exercise_equipment"
                                value={data.equipment}
                                onChange={(event) =>
                                    setData('equipment', event.target.value)
                                }
                                placeholder="Trap bar"
                            />
                            <GlassError message={errors.equipment} />
                        </div>
                    </div>

                    <div>
                        <GlassLabel htmlFor="exercise_instructions">
                            How to do it
                        </GlassLabel>
                        <GlassTextarea
                            id="exercise_instructions"
                            rows={4}
                            value={data.instructions}
                            onChange={(event) =>
                                setData('instructions', event.target.value)
                            }
                        />
                        <GlassError message={errors.instructions} />
                    </div>

                    <div>
                        <GlassLabel htmlFor="exercise_cues">
                            Cues — one per line
                        </GlassLabel>
                        <GlassTextarea
                            id="exercise_cues"
                            rows={3}
                            value={data.cues}
                            onChange={(event) =>
                                setData('cues', event.target.value)
                            }
                            placeholder={
                                'Brace before you lift\nBar stays close'
                            }
                        />
                        <GlassError message={errors.cues} />
                    </div>

                    {errors.exercise && (
                        <GlassError message={errors.exercise} />
                    )}

                    <div className="flex items-center gap-3">
                        <GlassButton type="submit" disabled={processing}>
                            {editing ? 'Save changes' : 'Add exercise'}
                        </GlassButton>
                        {editing && (
                            <button
                                type="button"
                                onClick={cancelEdit}
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
