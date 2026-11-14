import { useState } from 'react';
import GlassCard from '@/Components/Glass/GlassCard';
import GlassPagination from '@/Components/Glass/GlassPagination';
import StatPill from '@/Components/Glass/StatPill';
import TxRow from '@/Components/Glass/TxRow';
import { HeartIcon } from '@/Components/Glass/icons';
import { formatSeconds, formatSet, formatVolume } from '@/Lib/formatWorkout';
import { formatWhen } from '@/Lib/formatWhen';

/**
 * One logged workout, expanded to show its sets.
 *
 * `routine_name` is read off the session rather than the routine it came from,
 * so the history keeps reading correctly after a routine is renamed or deleted.
 */
function SessionRow({ session, expanded, onToggle, onDelete }) {
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
                        {session.routine_name ?? 'Freestyle workout'}
                        {session.is_open && (
                            <span
                                className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                style={{
                                    background: 'var(--warn-bg)',
                                    color: 'var(--warn-ink)',
                                }}
                            >
                                In progress
                            </span>
                        )}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                        {formatWhen(session.started_at)} · {session.set_count}{' '}
                        set
                        {session.set_count === 1 ? '' : 's'}
                        {session.duration_seconds
                            ? ` · ${formatSeconds(session.duration_seconds)}`
                            : ''}
                        {session.volume_grams > 0
                            ? ` · ${formatVolume(session.volume_grams)}`
                            : ''}
                    </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                    {expanded ? 'Hide' : 'Show'}
                </span>
            </button>

            {expanded && (
                <div className="border-t border-[var(--card-border)] px-3 py-3">
                    {session.sets.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">
                            No sets were logged against this workout.
                        </p>
                    ) : (
                        <ol className="space-y-1">
                            {session.sets.map((set) => (
                                <li
                                    key={set.id}
                                    className="flex items-baseline justify-between gap-3 text-sm"
                                >
                                    <span className="min-w-0 truncate text-[var(--ink)]">
                                        {set.exercise_name}
                                        {set.is_warmup && (
                                            <span className="ml-1.5 text-xs text-[var(--muted)]">
                                                warm-up
                                            </span>
                                        )}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-[var(--muted)]">
                                        {formatSet(set)}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}

                    {session.notes && (
                        <p className="mt-3 whitespace-pre-line text-sm text-[var(--muted)]">
                            {session.notes}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={() => onDelete(session)}
                        className="mt-3 text-xs text-[var(--muted)] hover:text-[var(--neg)]"
                    >
                        Delete workout
                    </button>
                </div>
            )}
        </div>
    );
}

export default function WorkoutSessionsView({
    sessions,
    entries,
    onDeleteSession,
    onDeleteEntry,
}) {
    const [expandedId, setExpandedId] = useState(null);

    const finished = sessions.filter((session) => !session.is_open);

    const totalVolume = finished.reduce(
        (sum, session) => sum + (session.volume_grams ?? 0),
        0,
    );
    const totalSets = finished.reduce(
        (sum, session) => sum + (session.set_count ?? 0),
        0,
    );

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
                <StatPill label="Workouts" value={finished.length} />
                <StatPill label="Sets" value={totalSets} dotColor="#5FCB9B" />
                <StatPill
                    label="Volume"
                    value={formatVolume(totalVolume)}
                    dotColor="#D4537E"
                />
            </div>

            <GlassCard title={`Tracked workouts (${sessions.length})`}>
                {sessions.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        Nothing tracked yet. Start a workout on Today and every
                        set you log lands here.
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {sessions.map((session) => (
                            <SessionRow
                                key={session.id}
                                session={session}
                                expanded={expandedId === session.id}
                                onToggle={() =>
                                    setExpandedId(
                                        expandedId === session.id
                                            ? null
                                            : session.id,
                                    )
                                }
                                onDelete={onDeleteSession}
                            />
                        ))}
                    </div>
                )}
            </GlassCard>

            <GlassCard title="Quick entries">
                {entries.data.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        The quick log holds anything you didn't track set by
                        set.
                    </p>
                ) : (
                    entries.data.map((entry) => (
                        <TxRow
                            key={entry.id}
                            icon={<HeartIcon size={14} />}
                            iconColor="#8A8F98"
                            title={entry.activity}
                            subtitle={
                                (entry.notes ? `${entry.notes} · ` : '') +
                                formatWhen(entry.logged_at)
                            }
                            action={
                                <button
                                    type="button"
                                    onClick={() => onDeleteEntry(entry)}
                                    className="ml-2 shrink-0 text-xs text-[var(--muted)] hover:text-[var(--neg)]"
                                >
                                    Delete
                                </button>
                            }
                        />
                    ))
                )}
            </GlassCard>

            <GlassPagination links={entries.links} />
        </div>
    );
}
