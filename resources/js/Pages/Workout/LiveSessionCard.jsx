import { useMemo } from 'react';
import { router } from '@inertiajs/react';
import GlassCard from '@/Components/Glass/GlassCard';
import StatPill from '@/Components/Glass/StatPill';
import TxRow from '@/Components/Glass/TxRow';
import { HeartIcon } from '@/Components/Glass/icons';
import { formatSet, formatVolume } from '@/Lib/formatWorkout';
import { nextSet, routineProgress } from '@/Lib/workoutProgress';
import RestTimerBar from './RestTimerBar';
import SetLogger from './SetLogger';

/**
 * The workout in progress: what to do next, the form that logs it, the rest
 * countdown, and the sets already logged.
 *
 * `openSession` comes from the server on every page load rather than being
 * held client-side, so a workout started on the phone shows up here and the
 * browser and the phone cannot disagree about what has been logged. Only the
 * rest countdown is client-side.
 */
export default function LiveSessionCard({ session, routines, exercises }) {
    const routine = useMemo(
        () =>
            routines.find((item) => item.id === session.workout_routine_id) ??
            null,
        [routines, session.workout_routine_id],
    );

    const suggestion = useMemo(
        () => (routine ? nextSet(routine.items, session.sets) : null),
        [routine, session.sets],
    );

    const progress = useMemo(
        () => (routine ? routineProgress(routine.items, session.sets) : null),
        [routine, session.sets],
    );

    const finish = () => {
        if (!window.confirm('Finish this workout?')) {
            return;
        }

        router.post(
            route('workouts.sessions.finish', session.id),
            {},
            { preserveScroll: true },
        );
    };

    const removeSet = (set) => {
        if (!window.confirm('Remove this set?')) {
            return;
        }

        router.delete(route('workouts.sets.destroy', set.id), {
            preserveScroll: true,
        });
    };

    return (
        <div className="flex flex-col gap-4">
            <GlassCard
                title={
                    session.routine_name
                        ? `In progress · ${session.routine_name}`
                        : 'In progress'
                }
                action={
                    <button
                        type="button"
                        onClick={finish}
                        className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--accent-ink)] transition hover:opacity-90"
                    >
                        Finish
                    </button>
                }
            >
                <div className="flex flex-wrap gap-2">
                    <StatPill label="Sets" value={session.set_count} />
                    <StatPill
                        label="Volume"
                        value={formatVolume(session.volume_grams)}
                        dotColor="#5FCB9B"
                    />
                    {progress && (
                        <StatPill
                            label="Routine"
                            value={`${progress.done} of ${progress.target}`}
                            dotColor="#D4537E"
                        />
                    )}
                </div>

                {suggestion ? (
                    <p className="mt-3 text-sm text-[var(--ink)]">
                        Up next:{' '}
                        <span className="font-semibold">
                            {suggestion.item.exercise_name}
                        </span>{' '}
                        <span className="text-[var(--muted)]">
                            — set {suggestion.setNumber} of{' '}
                            {suggestion.targetSets}
                            {suggestion.item.target_reps
                                ? `, target ${suggestion.item.target_reps} reps`
                                : ''}
                        </span>
                    </p>
                ) : (
                    routine && (
                        <p className="mt-3 text-sm text-[var(--muted)]">
                            Every target in {routine.name} is met. Log more if
                            you want to, or finish up.
                        </p>
                    )
                )}
            </GlassCard>

            <RestTimerBar />

            <GlassCard title="Log a set">
                <SetLogger
                    session={session}
                    exercises={exercises}
                    suggestion={suggestion}
                />
            </GlassCard>

            <GlassCard title={`Sets logged (${session.sets.length})`}>
                {session.sets.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        Nothing logged yet. The first set starts the clock.
                    </p>
                ) : (
                    [...session.sets].reverse().map((set) => (
                        <TxRow
                            key={set.id}
                            icon={<HeartIcon size={14} />}
                            iconColor={set.is_warmup ? '#8A8F98' : '#D4537E'}
                            title={set.exercise_name ?? 'Exercise'}
                            subtitle={
                                (set.is_warmup ? 'Warm-up · ' : '') +
                                formatSet(set)
                            }
                            action={
                                <button
                                    type="button"
                                    onClick={() => removeSet(set)}
                                    className="ml-2 shrink-0 text-xs text-[var(--muted)] hover:text-[var(--neg)]"
                                >
                                    Remove
                                </button>
                            }
                        />
                    ))
                )}
            </GlassCard>
        </div>
    );
}
