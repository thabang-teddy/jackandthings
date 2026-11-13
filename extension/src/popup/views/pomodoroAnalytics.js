import { h } from '../../lib/dom.js';

/**
 * The daily and weekly figures, read off `GET pomodoro-sessions/stats`.
 *
 * The server does the bucketing, in this browser's own timezone - see
 * App\Services\PomodoroAnalytics for why the client has to say which that is.
 * Nothing here derives data; it formats and arranges.
 */

/** Bars shorter than this are invisible, so an empty day still shows a floor. */
const MIN_BAR_PERCENT = 4;

/** "2h 3m", "45m" - nobody reads 7380 seconds as two hours. */
export function formatHoursMinutes(totalSeconds) {
    const seconds = Math.max(Math.round(totalSeconds ?? 0), 0);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);

    if (hours === 0) return `${minutes}m`;
    // 59.6 minutes rounding to 60 would print "2h 60m"; carry it instead.
    if (minutes === 60) return `${hours + 1}h 0m`;

    return `${hours}h ${minutes}m`;
}

function stat(label, value) {
    return h('div', { class: 'stat' }, [
        h('span', { class: 'muted small', text: label }),
        h('strong', { text: String(value) }),
    ]);
}

function dayChart(days) {
    const peak = Math.max(...days.map((day) => day.focus_seconds), 0);
    if (peak === 0) {
        return h('p', { class: 'muted small', text: 'Nothing logged this week yet.' });
    }

    const columns = days.map((day) => {
        const percent =
            day.focus_seconds === 0
                ? MIN_BAR_PERCENT
                : Math.max((day.focus_seconds / peak) * 100, MIN_BAR_PERCENT);

        return h(
            'div',
            {
                class: 'bar-col',
                // The text alternative matters more than the bar itself.
                title: `${day.label}: ${formatHoursMinutes(day.focus_seconds)}`,
            },
            [
                h('span', {
                    class: day.focus_seconds === 0 ? 'bar empty' : 'bar',
                    style: `height:${percent}%`,
                }),
                h('span', { class: 'bar-label', text: day.label }),
            ],
        );
    });

    return h('div', { class: 'bar-chart' }, columns);
}

export function renderAnalytics(stats) {
    const children = [
        h('div', { class: 'split' }, [
            stat('Today', formatHoursMinutes(stats.today.focus_seconds)),
            stat('Intervals', stats.today.intervals),
            stat('This week', formatHoursMinutes(stats.week.focus_seconds)),
            stat('Streak', `${stats.streak_days}d`),
        ]),
    ];

    if (stats.days?.length) {
        children.push(dayChart(stats.days));
    }

    if (stats.most_productive_hour !== null && stats.most_productive_hour !== undefined) {
        children.push(
            h('p', {
                class: 'muted small',
                text: `You focus most around ${String(stats.most_productive_hour).padStart(2, '0')}:00.`,
            }),
        );
    }

    for (const bucket of (stats.tags ?? []).slice(0, 3)) {
        children.push(
            h('div', { class: 'row' }, [
                h('span', { class: 'grow', text: bucket.tag ?? 'Untagged' }),
                h('span', {
                    class: 'muted small',
                    text: `${formatHoursMinutes(bucket.focus_seconds)} (${bucket.intervals})`,
                }),
            ]),
        );
    }

    return h('div', { class: 'card' }, [h('strong', { text: 'Focus analytics' }), ...children]);
}
