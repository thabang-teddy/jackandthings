import { useCallback, useEffect, useRef, useState } from 'react';
import { ALERT_TAGS, notify } from '@/Lib/desktopAlerts';
import { alarm } from '@/Lib/pomodoroSounds';

const STORAGE_KEY = 'jackandthings:workout-rest';

/**
 * The countdown between sets.
 *
 * Deliberately narrow: it knows how many seconds are left and nothing about
 * workouts. The workout itself comes from the server on every page (the
 * `openSession` prop), so there is only one copy of that state and the client
 * cannot drift from it. The *timer* cannot work that way - it has to keep
 * ticking as Inertia swaps pages - so it lives here, above the pages, and
 * round-trips through localStorage so it survives a reload too.
 *
 * Nothing about a rest timer is persisted on the server, which matches the
 * line the project already drew for Pomodoro: a running timer is client-side,
 * and only what has already happened is written down.
 *
 * The finishing chime is synthesised through the shared Pomodoro sound
 * recipes - no audio file ships with this project.
 */

/** Stored deadline, so time spent with the tab closed still counts. */
function readStored() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }

        const stored = JSON.parse(raw);
        if (!stored || typeof stored !== 'object' || !stored.endsAt) {
            return null;
        }

        return stored;
    } catch {
        return null;
    }
}

function writeStored(state) {
    try {
        if (state === null) {
            window.localStorage.removeItem(STORAGE_KEY);

            return;
        }

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Private browsing or a full quota: the timer still runs for this
        // tab, it just will not survive a reload.
    }
}

function secondsUntil(endsAt) {
    return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

function restoreInitialState() {
    const stored = readStored();

    if (!stored) {
        return { endsAt: null, totalSeconds: 0, label: null };
    }

    // A deadline that has already passed is dropped rather than firing late:
    // being told to stop resting twenty minutes after the fact is noise.
    if (secondsUntil(stored.endsAt) === 0) {
        writeStored(null);

        return { endsAt: null, totalSeconds: 0, label: null };
    }

    return {
        endsAt: stored.endsAt,
        totalSeconds: Number(stored.totalSeconds) || 0,
        label: stored.label ?? null,
    };
}

export function useRestTimer() {
    const [state, setState] = useState(restoreInitialState);
    const [secondsLeft, setSecondsLeft] = useState(() =>
        state.endsAt === null ? 0 : secondsUntil(state.endsAt),
    );

    // Guards the chime so a re-render, or a second tick landing on zero,
    // cannot sound it twice.
    const firedFor = useRef(null);

    const stop = useCallback(() => {
        setState({ endsAt: null, totalSeconds: 0, label: null });
        setSecondsLeft(0);
        writeStored(null);
    }, []);

    const start = useCallback(
        (seconds, label = null) => {
            const total = Math.max(0, Math.round(Number(seconds) || 0));

            if (total === 0) {
                stop();

                return;
            }

            const endsAt = Date.now() + total * 1000;

            firedFor.current = null;
            setState({ endsAt, totalSeconds: total, label });
            setSecondsLeft(total);
            writeStored({ endsAt, totalSeconds: total, label });
        },
        [stop],
    );

    const extend = useCallback(
        (seconds) => {
            if (state.endsAt === null) {
                return;
            }

            const added = Math.round(Number(seconds) || 0);
            const endsAt = state.endsAt + added * 1000;
            const total = state.totalSeconds + added;

            firedFor.current = null;
            setState((current) => ({
                ...current,
                endsAt,
                totalSeconds: total,
            }));
            setSecondsLeft(secondsUntil(endsAt));
            writeStored({ endsAt, totalSeconds: total, label: state.label });
        },
        [state.endsAt, state.totalSeconds, state.label],
    );

    // One interval, recomputing from the stored deadline rather than
    // decrementing a counter: a background tab throttles its timers, and
    // counting down by one each tick would drift behind the real clock.
    useEffect(() => {
        if (state.endsAt === null) {
            return undefined;
        }

        const sync = () => setSecondsLeft(secondsUntil(state.endsAt));

        sync();
        const handle = window.setInterval(sync, 250);

        return () => window.clearInterval(handle);
    }, [state.endsAt]);

    // Fires once when the countdown reaches zero, then clears itself.
    useEffect(() => {
        if (state.endsAt === null || secondsLeft > 0) {
            return;
        }

        if (firedFor.current === state.endsAt) {
            return;
        }

        firedFor.current = state.endsAt;

        alarm('chime');
        notify('Rest over', {
            body: state.label ? `Next: ${state.label}` : 'Back to it.',
            tag: ALERT_TAGS.workoutRestOver,
        });

        writeStored(null);
        setState({ endsAt: null, totalSeconds: 0, label: null });
    }, [secondsLeft, state.endsAt, state.label]);

    return {
        running: state.endsAt !== null,
        secondsLeft,
        totalSeconds: state.totalSeconds,
        label: state.label,
        start,
        stop,
        extend,
    };
}
