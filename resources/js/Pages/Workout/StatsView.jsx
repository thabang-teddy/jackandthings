import { useMemo, useState } from 'react';
import GlassCard from '@/Components/Glass/GlassCard';
import FocusBarChart from '@/Components/Glass/FocusBarChart';
import StatPill from '@/Components/Glass/StatPill';
import {
    formatDistance,
    formatKg,
    formatSeconds,
    formatVolume,
} from '@/Lib/formatWorkout';

const CATEGORY_LABELS = {
    strength: 'Strength',
    cardio: 'Cardio',
    flexibility: 'Flexibility',
    mobility: 'Mobility',
};

/**
 * The consistency calendar.
 *
 * Every day in the window is drawn, including the untrained ones - the gaps are
 * what a consistency view is for, and a calendar that only showed the good days
 * would flatter the user into thinking they had a streak.
 */
function Calendar({ days }) {
    const peak = Math.max(...days.map((day) => day.volume_grams ?? 0), 1);

    return (
        <div
            className="flex flex-wrap gap-1"
            role="list"
            aria-label="Workout calendar"
        >
            {days.map((day) => {
                // Opacity carries how much work, presence carries whether any
                // happened, so a light day still reads as trained.
                const share = day.trained
                    ? 0.35 + 0.65 * Math.min(1, (day.volume_grams ?? 0) / peak)
                    : 0;

                return (
                    <span
                        key={day.date}
                        role="listitem"
                        title={
                            day.trained
                                ? `${day.date}: ${day.sets} set${day.sets === 1 ? '' : 's'}`
                                : `${day.date}: nothing logged`
                        }
                        aria-label={
                            day.trained
                                ? `${day.date}, ${day.sets} sets`
                                : `${day.date}, nothing logged`
                        }
                        className="h-3.5 w-3.5 rounded-[3px] border"
                        style={{
                            borderColor: 'var(--card-border)',
                            background: day.trained
                                ? `color-mix(in oklab, var(--accent) ${Math.round(share * 100)}%, transparent)`
                                : 'transparent',
                        }}
                    />
                );
            })}
        </div>
    );
}

/** One exercise's best figures, showing only the measures it actually tracks. */
function RecordRow({ record }) {
    const figures = [
        record.best_one_rep_max_grams && {
            label: 'Est. 1RM',
            value: formatKg(record.best_one_rep_max_grams),
        },
        record.best_weight_grams && {
            label: 'Heaviest',
            value: formatKg(record.best_weight_grams),
        },
        record.best_reps && { label: 'Most reps', value: record.best_reps },
        record.best_distance_metres && {
            label: 'Furthest',
            value: formatDistance(record.best_distance_metres),
        },
        record.best_duration_seconds && {
            label: 'Longest',
            value: formatSeconds(record.best_duration_seconds),
        },
    ].filter(Boolean);

    return (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold text-[var(--ink)]">
                    {record.exercise_name ?? 'Exercise'}
                </p>
                <p className="shrink-0 text-xs text-[var(--muted)]">
                    {record.sets_logged} set
                    {record.sets_logged === 1 ? '' : 's'}
                </p>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {figures.map((figure) => (
                    <span
                        key={figure.label}
                        className="text-xs text-[var(--muted)]"
                    >
                        {figure.label}:{' '}
                        <span className="font-semibold text-[var(--ink)]">
                            {figure.value}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function WorkoutStatsView({ analytics, records }) {
    const [category, setCategory] = useState('');

    // FocusBarChart expects { key, label, tick, seconds }; volume is what this
    // chart measures, so it rides in on `seconds` and the labels say kg.
    const buckets = useMemo(
        () =>
            analytics.days.map((day) => ({
                key: day.date,
                label: day.label,
                tick: day.label,
                seconds: day.volume_grams,
            })),
        [analytics.days],
    );

    const visibleRecords = useMemo(
        () =>
            category
                ? records.filter((record) => record.category === category)
                : records,
        [records, category],
    );

    const categories = useMemo(
        () => [
            ...new Set(
                records.map((record) => record.category).filter(Boolean),
            ),
        ],
        [records],
    );

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
                <StatPill label="Day streak" value={analytics.streak_days} />
                <StatPill
                    label="Longest streak"
                    value={analytics.longest_streak_days}
                    dotColor="#5FCB9B"
                />
                <StatPill
                    label="This week"
                    value={`${analytics.sessions_this_week} workout${analytics.sessions_this_week === 1 ? '' : 's'}`}
                    dotColor="#D4537E"
                />
                <StatPill
                    label="Volume this week"
                    value={formatVolume(analytics.week.volume_grams)}
                    dotColor="#E0A355"
                />
            </div>

            <GlassCard title={`Volume, last ${analytics.chart_days} days`}>
                <FocusBarChart
                    buckets={buckets}
                    emptyMessage="Log some sets and this fills in."
                />
                <p className="mt-2 text-xs text-[var(--muted)]">
                    Bars are training volume — weight times reps. Cardio and
                    timed work are counted in the totals above but have no
                    volume of their own.
                </p>
            </GlassCard>

            <GlassCard
                title={`Consistency, last ${analytics.history_days} days`}
            >
                <Calendar days={analytics.calendar} />
                <p className="mt-2 text-xs text-[var(--muted)]">
                    Bucketed in {analytics.timezone}.
                </p>
            </GlassCard>

            {analytics.categories.length > 0 && (
                <GlassCard title="Where the training went">
                    <div className="flex flex-col gap-2">
                        {analytics.categories.map((bucket) => {
                            const share =
                                analytics.history.sets > 0
                                    ? (bucket.sets / analytics.history.sets) *
                                      100
                                    : 0;

                            return (
                                <div key={bucket.category ?? 'none'}>
                                    <div className="flex items-baseline justify-between text-xs">
                                        <span className="text-[var(--ink)]">
                                            {CATEGORY_LABELS[bucket.category] ??
                                                'Uncategorised'}
                                        </span>
                                        <span className="text-[var(--muted)]">
                                            {bucket.sets} set
                                            {bucket.sets === 1
                                                ? ''
                                                : 's'} · {Math.round(share)}%
                                        </span>
                                    </div>
                                    <div
                                        className="mt-1 h-1.5 overflow-hidden rounded-full"
                                        style={{
                                            background: 'var(--card-border)',
                                        }}
                                    >
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${share}%`,
                                                background: 'var(--accent)',
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </GlassCard>
            )}

            <GlassCard
                title={`Personal records (${visibleRecords.length})`}
                action={
                    categories.length > 1 && (
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={() => setCategory('')}
                                aria-pressed={category === ''}
                                className={
                                    'rounded-full px-2.5 py-1 text-[11px] font-semibold transition ' +
                                    (category === ''
                                        ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                                        : 'border border-[var(--card-border)] text-[var(--muted)]')
                                }
                            >
                                All
                            </button>
                            {categories.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setCategory(option)}
                                    aria-pressed={category === option}
                                    className={
                                        'rounded-full px-2.5 py-1 text-[11px] font-semibold transition ' +
                                        (category === option
                                            ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                                            : 'border border-[var(--card-border)] text-[var(--muted)]')
                                    }
                                >
                                    {CATEGORY_LABELS[option] ?? option}
                                </button>
                            ))}
                        </div>
                    )
                }
            >
                {visibleRecords.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        Records appear once you have logged sets. Warm-ups never
                        count towards one.
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {visibleRecords.map((record) => (
                            <RecordRow
                                key={record.exercise_id}
                                record={record}
                            />
                        ))}
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
