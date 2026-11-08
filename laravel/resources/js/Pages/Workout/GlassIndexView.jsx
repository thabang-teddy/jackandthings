import GlassCard from '@/Components/Glass/GlassCard';
import GlassPagination from '@/Components/Glass/GlassPagination';
import PillButton from '@/Components/Glass/PillButton';
import TxRow from '@/Components/Glass/TxRow';
import { BellIcon, HeartIcon } from '@/Components/Glass/icons';
import { Link } from '@inertiajs/react';

export default function WorkoutGlassIndexView({
    entries,
    dueForReminder,
    lastLoggedAt,
    onDestroy,
}) {
    return (
        <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--muted)]">
                    {entries.data.length} entr
                    {entries.data.length === 1 ? 'y' : 'ies'}
                </p>
                <PillButton href={route('workouts.create')} primary>
                    + Log workout
                </PillButton>
            </div>

            <div id="reminders">
                {dueForReminder ? (
                    <div
                        className="rounded-[22px] border p-5"
                        style={{
                            borderColor: 'var(--warn-border)',
                            background: 'var(--warn-bg)',
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <BellIcon
                                size={16}
                                style={{ color: 'var(--warn-ink)' }}
                            />
                            <div>
                                <p
                                    className="text-sm font-semibold"
                                    style={{ color: 'var(--warn-ink)' }}
                                >
                                    Nothing logged this hour
                                </p>
                                <p
                                    className="text-xs"
                                    style={{ color: 'var(--warn-muted)' }}
                                >
                                    {lastLoggedAt
                                        ? `Last workout: ${lastLoggedAt}.`
                                        : 'No workouts logged yet.'}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <GlassCard>
                        <p className="text-sm text-[var(--muted)]">
                            You're up to date — last workout:{' '}
                            {lastLoggedAt ?? 'none yet'}.
                        </p>
                    </GlassCard>
                )}
            </div>

            <GlassCard
                id="overview"
                title="Entries"
                className="min-h-0 flex-1 overflow-y-auto"
            >
                {entries.data.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        Log what you do through the day to build up a record.
                    </p>
                ) : (
                    entries.data.map((entry) => (
                        <TxRow
                            key={entry.id}
                            icon={<HeartIcon size={14} />}
                            iconColor="#D4537E"
                            title={entry.activity}
                            subtitle={
                                (entry.notes ? `${entry.notes} · ` : '') +
                                entry.logged_at
                            }
                            action={
                                <div className="ml-2 flex shrink-0 items-center gap-3 text-xs">
                                    <Link
                                        href={route('workouts.edit', entry.id)}
                                        className="text-[#8BB4FF] hover:underline"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => onDestroy(entry)}
                                        className="text-[var(--muted)] hover:text-[var(--neg)]"
                                    >
                                        Delete
                                    </button>
                                </div>
                            }
                        />
                    ))
                )}
            </GlassCard>

            <GlassPagination links={entries.links} />
        </div>
    );
}
