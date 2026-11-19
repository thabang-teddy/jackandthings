import { useCallback, useEffect, useRef } from 'react';
import { useCountdown } from './useCountdown';

/**
 * How often to poll the server for a live link started on another device.
 * Thirty seconds keeps the two surfaces within half a minute of each other
 * without hammering the session route.
 */
const POLL_MS = 30 * 1000;

function csrfToken() {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

async function postLiveLink(state) {
    try {
        await fetch(route('pomodoro-live-link.store'), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': csrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ state }),
        });
    } catch {
        // Offline: the link will catch up when the connection returns.
    }
}

async function deleteLiveLink() {
    try {
        await fetch(route('pomodoro-live-link.destroy'), {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'X-XSRF-TOKEN': csrfToken(),
            },
            credentials: 'same-origin',
        });
    } catch {
        // Offline: the link will catch up when the connection returns.
    }
}

/**
 * Wraps `useCountdown()` so the running state is posted to the server's live
 * link whenever the user acts on it, and so a timer started on the phone (or
 * another tab) can be adopted here.
 *
 * While a local timer is running, the local state wins: we never adopt a
 * remote timer over one that is already going. When idle, we poll and adopt
 * any remote running timer, so opening the welcome page mid-session shows
 * the same clock the phone is running.
 *
 * Only user actions push to the server - the second-by-second tick does not,
 * so the live link is updated on start, stop, pause, resume, skip and
 * restart rather than every tick.
 */
export function usePomodoroLiveLink() {
    const timer = useCountdown();
    const pollRef = useRef(null);

    /** The timer state worth posting: everything except the ticking seconds. */
    const currentState = useCallback(
        () => ({
            preset: timer.preset,
            phase: timer.phase,
            secondsLeft: timer.secondsLeft,
            running: timer.running,
            completedFocusCycles: timer.completedFocusCycles,
        }),
        [timer],
    );

    const push = useCallback(() => {
        const state = currentState();
        if (state.preset === null) {
            deleteLiveLink();
            return;
        }
        postLiveLink(state);
    }, [currentState]);

    const adoptRemote = useCallback(async () => {
        if (timer.preset !== null || timer.running) return;

        try {
            const response = await fetch(route('pomodoro-live-link.show'), {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            if (!response.ok) return;

            const { data } = await response.json();
            if (!data || !data.state || !data.state.running) return;
            if (data.state.preset === null) return;

            timer.start(data.state.preset);
        } catch {
            // Offline: try again on the next tick.
        }
    }, [timer]);

    // Wrap the mutating actions so each one pushes to the live link. The
    // preset is captured before the call so the pushed state is right even
    // though React state updates are async.
    const start = useCallback(
        (preset) => {
            timer.start(preset);
            push();
        },
        [timer, push],
    );

    const stop = useCallback(() => {
        timer.stop();
        push();
    }, [timer, push]);

    const pause = useCallback(() => {
        timer.pause();
        push();
    }, [timer, push]);

    const resume = useCallback(() => {
        timer.resume();
        push();
    }, [timer, push]);

    const skip = useCallback(() => {
        timer.skip();
        push();
    }, [timer, push]);

    const restart = useCallback(() => {
        timer.restart();
        push();
    }, [timer, push]);

    // Adopt a remote timer on mount, and keep polling while idle so a timer
    // started on the phone shows up here without a reload.
    useEffect(() => {
        adoptRemote();

        pollRef.current = window.setInterval(() => {
            if (timer.preset === null || !timer.running) {
                adoptRemote();
            }
        }, POLL_MS);

        return () => {
            if (pollRef.current !== null) {
                window.clearInterval(pollRef.current);
            }
        };
    }, [adoptRemote, timer.preset, timer.running]);

    return {
        ...timer,
        start,
        stop,
        pause,
        resume,
        skip,
        restart,
    };
}
