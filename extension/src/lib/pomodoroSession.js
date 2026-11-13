import { api } from './api.js';
import { phaseLabel } from './pomodoroCycle.js';

/**
 * Posting a finished interval to the server, which is what the daily and
 * weekly analytics are built from.
 *
 * Shared by the popup and the service worker: a phase that ends while the
 * popup is shut is ended by the background alarm, and that interval has to be
 * recorded too - otherwise the analytics would only ever see the sessions you
 * happened to be watching.
 */

/**
 * Below this, a phase change was a misclick rather than a session. Matches
 * MIN_LOGGED_SECONDS in the web app and PomodoroSessionRecorder on Android,
 * so the three surfaces agree about what is worth recording.
 */
export const MIN_LOGGED_SECONDS = 5;

/**
 * Records one finished or abandoned interval.
 *
 * Failures are swallowed on purpose: the timer must keep working when the
 * server is unreachable, and the user has no action to take about a lost
 * analytics row. Resolves to whether it was stored, for callers that care.
 */
export async function logSession(session, { completed, endedAt = Date.now() } = {}) {
    const startedAt = session?.startedAt;
    if (!session || !startedAt) return false;

    const durationSeconds = Math.round((endedAt - startedAt) / 1000);
    if (durationSeconds < MIN_LOGGED_SECONDS) return false;

    try {
        await api.createPomodoroSession({
            // A preset deleted mid-session would fail the server's scoped
            // exists rule; the name always carries the label either way.
            pomodoro_preset_id: session.presetId ?? null,
            preset_name: session.name,
            tag: session.tag ?? null,
            phase: session.phase,
            started_at: new Date(startedAt).toISOString(),
            ended_at: new Date(endedAt).toISOString(),
            duration_seconds: durationSeconds,
            completed: Boolean(completed),
            source: 'extension',
        });

        return true;
    } catch {
        return false;
    }
}

export function currentTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    } catch {
        return 'UTC';
    }
}

/** The notification text for a phase that just rolled over. */
export function rolloverMessage(endedPhase, nextPhase, autoStart) {
    const next = phaseLabel(nextPhase).toLowerCase();

    return {
        title: `${phaseLabel(endedPhase)} done — ${next}`,
        message: autoStart
            ? `Your ${next} has started.`
            : `Open Jack & Things to start your ${next}.`,
    };
}
