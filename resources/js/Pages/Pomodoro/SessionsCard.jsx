import GlassCard from '@/Components/Glass/GlassCard';
import { phaseLabel } from '@/Lib/pomodoroCycle';
import { formatHoursMinutes } from '@/Lib/formatDuration';

/**
 * The intervals behind the analytics, most recent first.
 *
 * Worth showing rather than only charting them: a number you cannot click
 * into is hard to trust, and an interval logged by mistake needs somewhere to
 * be removed from. Removing one is the only edit there is - a recorded
 * interval is history, so the server offers no update.
 */

function when(iso) {
    const at = new Date(iso);
    const today = new Date().toDateString() === at.toDateString();

    return at.toLocaleString(undefined, {
        ...(today ? {} : { month: 'short', day: 'numeric' }),
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function SessionsCard({ sessions, onDelete }) {
    return (
        <GlassCard
            id="sessions"
            title="Recent sessions"
            className="overflow-y-auto"
        >
            {sessions.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                    Nothing logged yet. Finish a focus run and it appears here.
                </p>
            ) : (
                <ul className="flex flex-col divide-y divide-[var(--card-border)]">
                    {sessions.map((session) => (
                        <li
                            key={session.id}
                            className="flex items-center justify-between gap-3 py-2"
                        >
                            <div className="min-w-0">
                                <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-[var(--ink)]">
                                    {session.preset_name}
                                    {session.tag && (
                                        <span className="shrink-0 rounded-full bg-[var(--card-border)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
                                            {session.tag}
                                        </span>
                                    )}
                                    {!session.completed && (
                                        <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-wide text-[var(--neg)]">
                                            cut short
                                        </span>
                                    )}
                                </p>
                                <p className="truncate text-[10.5px] text-[var(--muted)]">
                                    {phaseLabel(session.phase)} ·{' '}
                                    {formatHoursMinutes(
                                        session.duration_seconds,
                                    )}{' '}
                                    · {when(session.started_at)}
                                    {session.source && ` · ${session.source}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onDelete(session)}
                                className="shrink-0 text-[11px] text-[var(--neg)] hover:underline"
                            >
                                Remove
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </GlassCard>
    );
}
