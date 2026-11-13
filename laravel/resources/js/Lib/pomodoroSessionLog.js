import { router } from '@inertiajs/react';

/**
 * Posting a finished interval to the server, which is what the daily and
 * weekly analytics are built from.
 *
 * Deliberately axios rather than an Inertia visit. `pomodoro.sessions.store`
 * would redirect, and an Inertia POST follows that redirect - so a timer
 * finishing while the user was reading their notes would yank them onto the
 * Pomodoro page. The endpoint answers 204 to this instead, the same
 * "page talks to the session guard directly" shape `workouts/due` already
 * uses. Analytics props are then refreshed explicitly, and only when the
 * Pomodoro page is the one on screen.
 */

/**
 * Below this, a phase change was a misclick rather than a session. Logging
 * one-second rows would bury the real "started six, finished four" signal
 * the analytics exist to show.
 */
export const MIN_LOGGED_SECONDS = 5;

/**
 * Which props each Pomodoro page needs re-fetched once an interval lands.
 *
 * Keyed by page so a timer finishing on the Timer page pulls back one total
 * rather than the whole analytics payload, and so a page that shows none of
 * this costs nothing at all.
 */
const REFRESH_PROPS = {
    'Pomodoro/Index': ['today', 'timezone'],
    'Pomodoro/Sessions': ['sessions', 'today', 'timezone'],
    'Pomodoro/Stats': ['analytics'],
};

function tz() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    } catch {
        return '';
    }
}

/**
 * Records one finished or abandoned interval.
 *
 * Failures are swallowed on purpose: the countdown must keep working when the
 * server is unreachable, and the user has no action to take about a lost
 * analytics row. The promise resolves to whether it was stored, for callers
 * that care (the tests do).
 */
export async function logSession({
    preset,
    phase,
    startedAt,
    endedAt = Date.now(),
    completed,
}) {
    const durationSeconds = Math.round((endedAt - startedAt) / 1000);

    if (!preset || durationSeconds < MIN_LOGGED_SECONDS) {
        return false;
    }

    try {
        await window.axios.post(route('pomodoro.sessions.store'), {
            // A preset the user deleted mid-session would fail the scoped
            // exists rule, so the id is sent only when it is still a real
            // one; `preset_name` always carries the label either way.
            pomodoro_preset_id: preset.id ?? null,
            preset_name: preset.name,
            tag: preset.tag ?? null,
            phase,
            started_at: new Date(startedAt).toISOString(),
            ended_at: new Date(endedAt).toISOString(),
            duration_seconds: durationSeconds,
            completed,
        });

        return true;
    } catch {
        return false;
    }
}

/**
 * Pulls the fresh figures onto whichever Pomodoro page is on screen. A no-op
 * everywhere else, so an interval ending while the user is reading their
 * notes costs nothing.
 */
export function refreshAnalytics(component) {
    const only = REFRESH_PROPS[component];
    if (!only) {
        return;
    }

    router.reload({
        only,
        data: { tz: tz() },
        preserveScroll: true,
        preserveState: true,
    });
}

export { tz as currentTimezone };
