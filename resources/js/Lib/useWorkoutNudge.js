import { useEffect } from 'react';
// Relative rather than the usual `@/Lib/...`: Vite resolves that alias but
// `node --test` does not, and the dedupe below is covered by a plain Node
// test. Both resolve this form.
import { ALERT_TAGS, alertsEnabled, notify } from './desktopAlerts.js';

// The server's due-check is per clock hour, so polling faster only costs
// requests. Fifteen minutes keeps the nudge within a quarter hour of the
// boundary without hammering the session route.
const POLL_MS = 15 * 60 * 1000;
const STORAGE_KEY = 'jackandthings:workout-nudged-hour';

/**
 * The dedupe is exported as plain functions so it can be tested without a
 * renderer, the way the add-on exposes its Pomodoro helpers. The hook below
 * is the only caller in the app.
 */
export function currentHour(now = new Date()) {
    return `${now.toDateString()}:${now.getHours()}`;
}

/**
 * Which hour was last nudged for, kept in storage rather than component
 * state: the home page and AuthenticatedLayout mount this hook from
 * different components, so moving between them remounts it and a value held
 * in a ref would nudge again on every navigation.
 */
export function alreadyNudged(hour) {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === hour;
    } catch {
        // Without storage the dedupe is impossible, so err towards silence.
        return true;
    }
}

export function markNudged(hour) {
    try {
        window.localStorage.setItem(STORAGE_KEY, hour);
    } catch {
        // Nothing to do; the guard above already keeps this quiet.
    }
}

/**
 * Raises the hourly "nothing logged this hour" desktop alert while a page is
 * open, at most once per clock hour.
 *
 * The same state already renders as an in-page banner; this only adds the
 * notification. See Lib/desktopAlerts for why the page raises it rather than
 * the server pushing one.
 */
export function useWorkoutNudge(url) {
    useEffect(() => {
        let cancelled = false;

        const check = async () => {
            if (!alertsEnabled()) {
                return;
            }

            const hour = currentHour();
            if (alreadyNudged(hour)) {
                return;
            }

            try {
                const response = await fetch(url, {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                });

                // A signed-out or expired session answers with a redirect to
                // the login page; there is nothing to nudge about then.
                if (!response.ok || cancelled) {
                    return;
                }

                const state = await response.json();
                if (cancelled || !state?.due) {
                    return;
                }

                markNudged(hour);
                notify('No workout logged this hour', {
                    body: 'Log what you have done.',
                    tag: ALERT_TAGS.workoutDue,
                });
            } catch {
                // Offline or a dropped request: try again on the next tick
                // rather than surfacing anything to the page.
            }
        };

        check();
        const id = window.setInterval(check, POLL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, [url]);
}
