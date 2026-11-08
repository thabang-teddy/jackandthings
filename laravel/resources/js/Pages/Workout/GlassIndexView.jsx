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
                <p className="text-sm text-white/40">
                    {entries.data.length} entr
                    {entries.data.length === 1 ? 'y' : 'ies'}
                </p>
                <PillButton href={route('workouts.create')} primary>
                    + Log workout
                </PillButton>
            </div>

            <div id="reminders">
                {dueForReminder ? (
                    <GlassCard className="border-amber-400/30 bg-amber-400/10">
                        <div className="flex items-center gap-3">
                            <BellIcon size={16} className="text-amber-300" />
                            <div>
                                <p className="text-sm font-semibold text-amber-200">
                                    Nothing logged this hour
                                </p>
                                <p className="text-xs text-amber-200/70">
                                    {lastLoggedAt
                                        ? `Last workout: ${lastLoggedAt}.`
                                        : 'No workouts logged yet.'}
                                </p>
                            </div>
                        </div>
                    </GlassCard>
                ) : (
                    <GlassCard>
                        <p className="text-sm text-white/50">
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
                    <p className="text-sm text-white/40">
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
                                        className="text-white/30 hover:text-rose-400"
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
