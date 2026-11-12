import { useEffect, useRef, useState } from 'react';

const PHASE_FOCUS = 'focus';
const PHASE_BREAK = 'break';
const STORAGE_KEY = 'jackandthings:pomodoro';

function durationFor(preset, phase) {
    return (
        (phase === PHASE_FOCUS ? preset.focus_minutes : preset.break_minutes) *
        60
    );
}

function readStoredState() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }

        const stored = JSON.parse(raw);
        if (!stored || typeof stored !== 'object' || !stored.preset) {
            return null;
        }

        return stored;
    } catch {
        return null;
    }
}

function writeStoredState(state) {
    try {
        if (state.preset === null) {
            window.localStorage.removeItem(STORAGE_KEY);
            return;
        }

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage can be unavailable (private browsing, quota); the timer
        // still works for this tab, it just won't survive a reload.
    }
}

/**
 * Restore whatever preset/phase/countdown was saved, adjusting `secondsLeft`
 * for the real time that passed while the page was closed or in the
 * background (the interval timer doesn't tick while the tab is unloaded).
 */
function restoreInitialState() {
    const stored = readStoredState();
    if (!stored) {
        return {
            preset: null,
            phase: PHASE_FOCUS,
            secondsLeft: 0,
            running: false,
        };
    }

    const elapsed = stored.running
        ? Math.max(0, Math.floor((Date.now() - stored.updatedAt) / 1000))
        : 0;

    return {
        preset: stored.preset,
        phase: stored.phase,
        secondsLeft: Math.max(0, stored.secondsLeft - elapsed),
        running: stored.running,
    };
}

/**
 * Client-side Pomodoro countdown. State round-trips through localStorage so
 * a running or paused session survives a reload; only presets themselves
 * come from the server. Shared by the Pomodoro page and the home page's
 * time/Pomodoro toggle.
 */
export function useCountdown() {
    const initialRef = useRef(null);
    if (initialRef.current === null) {
        initialRef.current = restoreInitialState();
    }
    const initial = initialRef.current;

    const [preset, setPreset] = useState(initial.preset);
    const [phase, setPhase] = useState(initial.phase);
    const [secondsLeft, setSecondsLeft] = useState(initial.secondsLeft);
    const [running, setRunning] = useState(initial.running);
    const intervalRef = useRef(null);

    useEffect(() => {
        writeStoredState({
            preset,
            phase,
            secondsLeft,
            running,
            updatedAt: Date.now(),
        });
    }, [preset, phase, secondsLeft, running]);

    useEffect(() => {
        if (!running) {
            return undefined;
        }

        intervalRef.current = window.setInterval(() => {
            setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
        }, 1000);

        return () => window.clearInterval(intervalRef.current);
    }, [running]);

    useEffect(() => {
        if (secondsLeft !== 0 || !running || preset === null) {
            return;
        }

        // Focus rolls into the break, then the timer stops.
        if (phase === PHASE_FOCUS && preset.break_minutes > 0) {
            setPhase(PHASE_BREAK);
            setSecondsLeft(preset.break_minutes * 60);
        } else {
            setRunning(false);
        }
    }, [secondsLeft, running, phase, preset]);

    const start = (chosen) => {
        setPreset(chosen);
        setPhase(PHASE_FOCUS);
        setSecondsLeft(chosen.focus_minutes * 60);
        setRunning(true);
    };

    // Load a preset's focus time onto the clock without starting it, so the
    // Overview's preset picker can preview a choice before pressing Start.
    const select = (chosen) => {
        setPreset(chosen);
        setPhase(PHASE_FOCUS);
        setSecondsLeft(chosen.focus_minutes * 60);
        setRunning(false);
    };

    const stop = () => {
        setRunning(false);
        setSecondsLeft(0);
        setPreset(null);
        setPhase(PHASE_FOCUS);
    };

    // Restart the current preset from the top of the focus phase, paused.
    const restart = () => {
        if (preset === null) {
            return;
        }

        setPhase(PHASE_FOCUS);
        setSecondsLeft(preset.focus_minutes * 60);
        setRunning(false);
    };

    // Jump straight to the other phase (focus <-> break) without waiting for
    // the clock to run out. Mirrors the natural roll-over when there's no
    // break to skip into.
    const skip = () => {
        if (preset === null) {
            return;
        }

        if (phase === PHASE_FOCUS) {
            if (preset.break_minutes > 0) {
                setPhase(PHASE_BREAK);
                setSecondsLeft(durationFor(preset, PHASE_BREAK));
            } else {
                setRunning(false);
                setSecondsLeft(0);
            }
            return;
        }

        setPhase(PHASE_FOCUS);
        setSecondsLeft(durationFor(preset, PHASE_FOCUS));
    };

    return {
        preset,
        phase,
        secondsLeft,
        running,
        start,
        select,
        stop,
        restart,
        skip,
        pause: () => setRunning(false),
        resume: () => setRunning(true),
    };
}
