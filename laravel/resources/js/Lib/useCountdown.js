import { useEffect, useRef, useState } from 'react';

const PHASE_FOCUS = 'focus';
const PHASE_BREAK = 'break';

/**
 * Client-side Pomodoro countdown. Nothing about a running timer is persisted —
 * only presets round-trip to the server — so this hook owns all timer state.
 * Shared by the Pomodoro page and the home page's time/Pomodoro toggle.
 */
export function useCountdown() {
    const [preset, setPreset] = useState(null);
    const [phase, setPhase] = useState(PHASE_FOCUS);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [running, setRunning] = useState(false);
    const intervalRef = useRef(null);

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

    const stop = () => {
        setRunning(false);
        setSecondsLeft(0);
        setPreset(null);
        setPhase(PHASE_FOCUS);
    };

    return {
        preset,
        phase,
        secondsLeft,
        running,
        start,
        stop,
        pause: () => setRunning(false),
        resume: () => setRunning(true),
    };
}
