import { useWorkoutRest } from '@/Lib/WorkoutRestContext';
import { formatSeconds } from '@/Lib/formatWorkout';

/**
 * The countdown between sets.
 *
 * Reads the timer from the layout-level provider rather than owning it, so the
 * same bar can appear on any page and a rest started on Today keeps running
 * while you look at Sessions.
 *
 * Renders nothing when no rest is running - an idle "0:00" bar would take up
 * the room a set logger needs.
 */
export default function RestTimerBar() {
    const { running, secondsLeft, totalSeconds, label, stop, extend } =
        useWorkoutRest();

    if (!running) {
        return null;
    }

    const elapsed = Math.max(0, totalSeconds - secondsLeft);
    const share =
        totalSeconds > 0 ? Math.min(100, (elapsed / totalSeconds) * 100) : 0;

    return (
        <div
            className="rounded-[22px] border p-4"
            style={{
                borderColor: 'var(--card-border)',
                background: 'var(--card-bg)',
            }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                        Resting
                    </p>
                    <p className="font-mono text-3xl font-bold tabular-nums text-[var(--ink)]">
                        {formatSeconds(secondsLeft)}
                    </p>
                    {label && (
                        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                            Next: {label}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={() => extend(30)}
                        className="rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]"
                    >
                        +30s
                    </button>
                    <button
                        type="button"
                        onClick={stop}
                        className="rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]"
                    >
                        Skip
                    </button>
                </div>
            </div>

            <div
                className="mt-3 h-1.5 overflow-hidden rounded-full"
                style={{ background: 'var(--card-border)' }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={totalSeconds}
                aria-valuenow={elapsed}
                aria-label="Rest progress"
            >
                <div
                    className="h-full rounded-full transition-[width] duration-300 ease-linear"
                    style={{ width: `${share}%`, background: 'var(--accent)' }}
                />
            </div>
        </div>
    );
}
