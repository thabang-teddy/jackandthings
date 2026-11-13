import { useEffect, useMemo, useState } from 'react';
import { useForm } from '@inertiajs/react';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassSelect,
} from '@/Components/Glass/GlassFormControls';
import { useWorkoutRest } from '@/Lib/WorkoutRestContext';
import { kgToGrams } from '@/Lib/formatWorkout';
import { fieldsFor, restSecondsFor } from '@/Lib/workoutProgress';

const BLANK = {
    exercise_id: '',
    reps: '',
    weight_kg: '',
    distance_metres: '',
    duration_seconds: '',
    rpe: '',
    is_warmup: false,
};

/**
 * The form that logs one set during a live workout.
 *
 * Which inputs it draws comes from the exercise's metric through
 * `fieldsFor()` - the same rule the server enforces and the other two clients
 * read - so a plank never asks for a weight and a bench press never asks for a
 * distance.
 *
 * On a successful save it starts the rest countdown itself, using the routine
 * item's own rest time where there is one. That is the behaviour the issue asks
 * for: the timer should be automatic, not another button to remember.
 */
export default function SetLogger({ session, exercises, suggestion }) {
    const rest = useWorkoutRest();

    const { data, setData, post, processing, errors, reset, transform } =
        useForm({
            ...BLANK,
            exercise_id: suggestion?.exercise_id ?? '',
        });

    // Remembered per exercise so a second set of the same lift does not make
    // the user retype the weight they just used.
    const [lastUsed, setLastUsed] = useState({});

    // Follows the routine as it advances, but never overwrites a choice the
    // user has just made by hand for a different exercise.
    useEffect(() => {
        if (!suggestion?.exercise_id) {
            return;
        }

        setData('exercise_id', suggestion.exercise_id);
        // Only the suggestion moving should re-point the picker. useForm gives
        // a new `setData` identity on every render, so depending on it would
        // reset the field under the user as they typed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [suggestion?.exercise_id, suggestion?.setNumber]);

    const exercise = useMemo(
        () => exercises.find((item) => item.id === data.exercise_id) ?? null,
        [exercises, data.exercise_id],
    );

    const fields = fieldsFor(exercise?.metric);

    const submit = (event) => {
        event.preventDefault();

        if (!data.exercise_id) {
            return;
        }

        // Kilograms are what a person types; grams are what the server stores.
        transform((payload) => ({
            exercise_id: payload.exercise_id,
            is_warmup: payload.is_warmup,
            reps: payload.reps === '' ? null : Number(payload.reps),
            weight_grams: kgToGrams(payload.weight_kg),
            distance_metres:
                payload.distance_metres === ''
                    ? null
                    : Number(payload.distance_metres),
            duration_seconds:
                payload.duration_seconds === ''
                    ? null
                    : Number(payload.duration_seconds),
            rpe: payload.rpe === '' ? null : Number(payload.rpe),
        }));

        post(route('workouts.sets.store', session.id), {
            preserveScroll: true,
            onSuccess: () => {
                setLastUsed((current) => ({
                    ...current,
                    [data.exercise_id]: {
                        weight_kg: data.weight_kg,
                        reps: data.reps,
                        distance_metres: data.distance_metres,
                        duration_seconds: data.duration_seconds,
                    },
                }));

                // Rest starts from the routine's own figure where the workout
                // follows one, and from the shared default otherwise.
                rest.start(
                    restSecondsFor(suggestion?.item),
                    suggestion?.item?.exercise_name ?? exercise?.name ?? null,
                );

                reset('rpe');
            },
        });
    };

    const prefillFromLast = () => {
        const previous = lastUsed[data.exercise_id];

        if (!previous) {
            return;
        }

        setData((current) => ({ ...current, ...previous }));
    };

    return (
        <form onSubmit={submit} className="space-y-3">
            <div>
                <GlassLabel htmlFor="set_exercise">Exercise</GlassLabel>
                <GlassSelect
                    id="set_exercise"
                    value={data.exercise_id}
                    onChange={(event) =>
                        setData('exercise_id', event.target.value)
                    }
                    required
                >
                    <option value="">Pick an exercise…</option>
                    {exercises.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name}
                        </option>
                    ))}
                </GlassSelect>
                <GlassError message={errors.exercise_id} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                {fields.weight && (
                    <div>
                        <GlassLabel htmlFor="set_weight">
                            Weight (kg)
                        </GlassLabel>
                        <GlassInput
                            id="set_weight"
                            type="number"
                            step="0.5"
                            min="0"
                            inputMode="decimal"
                            value={data.weight_kg}
                            onChange={(event) =>
                                setData('weight_kg', event.target.value)
                            }
                        />
                        <GlassError message={errors.weight_grams} />
                    </div>
                )}

                {fields.reps && (
                    <div>
                        <GlassLabel htmlFor="set_reps">Reps</GlassLabel>
                        <GlassInput
                            id="set_reps"
                            type="number"
                            min="1"
                            inputMode="numeric"
                            value={data.reps}
                            onChange={(event) =>
                                setData('reps', event.target.value)
                            }
                        />
                        <GlassError message={errors.reps} />
                    </div>
                )}

                {fields.distance && (
                    <div>
                        <GlassLabel htmlFor="set_distance">
                            Distance (m)
                        </GlassLabel>
                        <GlassInput
                            id="set_distance"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={data.distance_metres}
                            onChange={(event) =>
                                setData('distance_metres', event.target.value)
                            }
                        />
                        <GlassError message={errors.distance_metres} />
                    </div>
                )}

                {fields.duration && (
                    <div>
                        <GlassLabel htmlFor="set_duration">
                            Time (seconds)
                        </GlassLabel>
                        <GlassInput
                            id="set_duration"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={data.duration_seconds}
                            onChange={(event) =>
                                setData('duration_seconds', event.target.value)
                            }
                        />
                        <GlassError message={errors.duration_seconds} />
                    </div>
                )}

                <div>
                    <GlassLabel htmlFor="set_rpe">RPE (optional)</GlassLabel>
                    <GlassInput
                        id="set_rpe"
                        type="number"
                        min="1"
                        max="10"
                        inputMode="numeric"
                        value={data.rpe}
                        onChange={(event) => setData('rpe', event.target.value)}
                    />
                    <GlassError message={errors.rpe} />
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                    <input
                        type="checkbox"
                        checked={data.is_warmup}
                        onChange={(event) =>
                            setData('is_warmup', event.target.checked)
                        }
                        className="rounded border-[var(--card-border)] bg-[var(--card-bg)]"
                    />
                    Warm-up (not counted towards records)
                </label>

                <div className="flex items-center gap-2">
                    {lastUsed[data.exercise_id] && (
                        <button
                            type="button"
                            onClick={prefillFromLast}
                            className="rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]"
                        >
                            Same again
                        </button>
                    )}
                    <GlassButton
                        type="submit"
                        disabled={processing || !data.exercise_id}
                    >
                        Log set
                    </GlassButton>
                </div>
            </div>
        </form>
    );
}
