import { formatHoursMinutes } from '@/Lib/formatDuration';

/**
 * A column chart of focus time per bucket, used for both the seven-day view
 * and the hour-of-day histogram.
 *
 * Deliberately not a sparkline: these are discrete buckets with gaps that
 * matter - a day with nothing on it should read as an empty column, not as a
 * line dipping through it. Caller passes buckets already computed by the
 * server (PomodoroAnalytics); this component derives nothing but heights.
 */

/** Bars shorter than this are invisible, so an empty bucket still shows a floor. */
const MIN_BAR_PERCENT = 2;

export default function FocusBarChart({
    buckets,
    highlightKey = null,
    emptyMessage = 'No focus time recorded yet.',
    height = 120,
}) {
    const peak = Math.max(...buckets.map((bucket) => bucket.seconds), 0);

    if (peak === 0) {
        return (
            <p
                className="flex items-center text-xs text-[var(--muted)]"
                style={{ minHeight: height }}
            >
                {emptyMessage}
            </p>
        );
    }

    return (
        <div>
            <div
                className="flex items-end gap-1.5"
                style={{ height }}
                role="list"
                aria-label="Focus time per bucket"
            >
                {buckets.map((bucket) => {
                    const percent =
                        bucket.seconds === 0
                            ? MIN_BAR_PERCENT
                            : Math.max(
                                  (bucket.seconds / peak) * 100,
                                  MIN_BAR_PERCENT,
                              );
                    const highlighted = bucket.key === highlightKey;

                    return (
                        <div
                            key={bucket.key}
                            role="listitem"
                            // h-full matters: the bar's height is a
                            // percentage, and a percentage of an auto-height
                            // column is nothing at all.
                            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                            // The text alternative matters more than the bar:
                            // the countdown is already unannounced (see
                            // docs/DESIGN_SYSTEM.md), so at least say the numbers.
                            title={`${bucket.label}: ${formatHoursMinutes(bucket.seconds)}`}
                            aria-label={`${bucket.label}: ${formatHoursMinutes(bucket.seconds)}`}
                        >
                            <div
                                className={
                                    'w-full rounded-t-md transition-all ' +
                                    (bucket.seconds === 0
                                        ? 'bg-[var(--card-border)]'
                                        : highlighted
                                          ? 'bg-[var(--accent)]'
                                          : 'bg-[var(--accent)] opacity-45')
                                }
                                style={{ height: `${percent}%` }}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="mt-1.5 flex gap-1.5">
                {buckets.map((bucket) => (
                    <span
                        key={bucket.key}
                        aria-hidden="true"
                        className={
                            'min-w-0 flex-1 truncate text-center text-[9.5px] ' +
                            (bucket.key === highlightKey
                                ? 'font-bold text-[var(--ink)]'
                                : 'text-[var(--muted)]')
                        }
                    >
                        {bucket.tick ?? bucket.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
