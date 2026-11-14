import { useState } from 'react';
import GlassCard from '@/Components/Glass/GlassCard';
import StatPill from '@/Components/Glass/StatPill';
import FocusBarChart from '@/Components/Glass/FocusBarChart';
import { formatHourOfDay, formatHoursMinutes } from '@/Lib/formatDuration';

/**
 * The daily and weekly view issue #3 asks for: total focus hours, completed
 * intervals, and the times of day the work actually happened.
 *
 * Every number here comes from App\Services\PomodoroAnalytics, already
 * bucketed in this browser's timezone - the page sends its zone with the
 * request precisely so these buckets line up with the user's own day. This
 * component only formats and arranges.
 */

const VIEWS = [
    { id: 'week', label: '7 days' },
    { id: 'hours', label: 'Time of day' },
];

function dayBuckets(days) {
    return days.map((day) => ({
        key: day.date,
        label: day.date,
        tick: day.label,
        seconds: day.focus_seconds,
    }));
}

/**
 * Hour buckets are labelled every six hours only - twenty-four labels at this
 * width are unreadable, and the per-bar title still names each one exactly.
 */
function hourBuckets(hours) {
    return hours.map((bucket) => ({
        key: String(bucket.hour),
        label: formatHourOfDay(bucket.hour),
        tick: bucket.hour % 6 === 0 ? String(bucket.hour) : '',
        seconds: bucket.focus_seconds,
    }));
}

function TagRow({ tag, seconds, intervals, share }) {
    return (
        <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs font-semibold text-[var(--ink)]">
                {tag ?? 'Untagged'}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--card-border)]">
                <span
                    className="block h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${share}%` }}
                />
            </span>
            <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-[var(--muted)]">
                {formatHoursMinutes(seconds)}
                <span className="ml-1 opacity-60">({intervals})</span>
            </span>
        </div>
    );
}

export default function AnalyticsCard({ analytics }) {
    const [view, setView] = useState('week');

    const peakHour = analytics.most_productive_hour;
    const tagTotal = analytics.tags.reduce(
        (sum, entry) => sum + entry.focus_seconds,
        0,
    );

    return (
        <GlassCard
            id="analytics"
            title="Focus analytics"
            action={
                <div className="flex gap-1">
                    {VIEWS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setView(option.id)}
                            aria-pressed={view === option.id}
                            className={
                                'rounded-full px-2.5 py-1 text-[10px] font-bold transition ' +
                                (view === option.id
                                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                                    : 'text-[var(--muted)] hover:text-[var(--ink)]')
                            }
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                    <StatPill
                        label="Focus today"
                        value={formatHoursMinutes(
                            analytics.today.focus_seconds,
                        )}
                    />
                    <StatPill
                        label="Intervals today"
                        value={analytics.today.intervals}
                        dotColor="#4ADE80"
                    />
                    <StatPill
                        label="This week"
                        value={formatHoursMinutes(analytics.week.focus_seconds)}
                        dotColor="#FBBF24"
                    />
                    <StatPill
                        label="Day streak"
                        value={analytics.streak_days}
                        dotColor="#F472B6"
                    />
                </div>

                {view === 'week' ? (
                    <FocusBarChart
                        buckets={dayBuckets(analytics.days)}
                        highlightKey={analytics.days.at(-1)?.date ?? null}
                        emptyMessage="Nothing logged this week yet — finish an interval and it lands here."
                    />
                ) : (
                    <div>
                        <FocusBarChart
                            buckets={hourBuckets(analytics.hours)}
                            highlightKey={
                                peakHour === null ? null : String(peakHour)
                            }
                            emptyMessage={`No focus time in the last ${analytics.history_days} days.`}
                        />
                        <p className="mt-2 text-[11px] text-[var(--muted)]">
                            {peakHour === null
                                ? `Hour of day over the last ${analytics.history_days} days.`
                                : `You focus most around ${formatHourOfDay(peakHour)}, over the last ${analytics.history_days} days.`}
                        </p>
                    </div>
                )}

                {analytics.tags.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-[var(--card-border)] pt-3">
                        <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                            Where the time went
                        </p>
                        {analytics.tags.slice(0, 6).map((entry) => (
                            <TagRow
                                key={entry.tag ?? 'untagged'}
                                tag={entry.tag}
                                seconds={entry.focus_seconds}
                                intervals={entry.intervals}
                                share={
                                    tagTotal === 0
                                        ? 0
                                        : (entry.focus_seconds / tagTotal) * 100
                                }
                            />
                        ))}
                    </div>
                )}

                {analytics.completion_rate !== null && (
                    <p className="text-[11px] text-[var(--muted)]">
                        {analytics.completion_rate}% of the focus intervals you
                        started in the last {analytics.history_days} days ran to
                        the end. Times shown in {analytics.timezone}.
                    </p>
                )}
            </div>
        </GlassCard>
    );
}
