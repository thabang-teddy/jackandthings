import { useCallback, useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { ALERT_TAGS, notify } from '@/Lib/desktopAlerts';
import {
    PHASE_FOCUS,
    cyclePosition,
    isBreak,
    nextPhase,
    phaseLabel,
    phaseMessage,
    secondsFor,
} from '@/Lib/pomodoroCycle';
import { alarm, ambience, stopAll, tick } from '@/Lib/pomodoroSounds';
import { logSession, refreshAnalytics } from '@/Lib/pomodoroSessionLog';
import { disengageStrictMode, engageStrictMode } from '@/Lib/strictMode';

const STORAGE_KEY = 'jackandthings:pomodoro';

/**
 * Client-side Pomodoro countdown.
 *
 * The timing rules themselves live in Lib/pomodoroCycle.js - this hook is the
 * part that cannot be pure: the interval, localStorage, the alarm, the
 * ambience bed, strict mode, and posting each finished interval to the server.
 *
 * State round-trips through localStorage so a running or paused session
 * survives a reload. Presets and the analytics come from the server; the
 * running timer does not, by design - see the create_pomodoro_sessions_table
 * migration for where that line now sits.
 */

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
            completedFocusCycles: 0,
            phaseStartedAt: null,
        };
    }

    const elapsed = stored.running
        ? Math.max(0, Math.floor((Date.now() - stored.updatedAt) / 1000))
        : 0;

    return {
        preset: stored.preset,
        // A pre-issue-#3 entry saved phase 'break'; map it onto the short
        // break rather than falling back to focus and losing the user's place.
        phase: stored.phase === 'break' ? 'short_break' : stored.phase,
        secondsLeft: Math.max(0, stored.secondsLeft - elapsed),
        running: stored.running,
        completedFocusCycles: stored.completedFocusCycles ?? 0,
        phaseStartedAt: stored.phaseStartedAt ?? null,
    };
}

export function useCountdown() {
    const initialRef = useRef(null);
    if (initialRef.current === null) {
        initialRef.current = restoreInitialState();
    }
    const initial = initialRef.current;

    const { component } = usePage();

    const [preset, setPreset] = useState(initial.preset);
    const [phase, setPhase] = useState(initial.phase);
    const [secondsLeft, setSecondsLeft] = useState(initial.secondsLeft);
    const [running, setRunning] = useState(initial.running);
    const [completedFocusCycles, setCompletedFocusCycles] = useState(
        initial.completedFocusCycles,
    );
    const [leftPageDuringFocus, setLeftPageDuringFocus] = useState(false);

    // When the current phase began, used as the logged session's start. A ref
    // rather than state: it must be readable from the tick effect without
    // making that effect re-run, and nothing renders from it.
    const phaseStartedAt = useRef(initial.phaseStartedAt);
    const intervalRef = useRef(null);

    useEffect(() => {
        writeStoredState({
            preset,
            phase,
            secondsLeft,
            running,
            completedFocusCycles,
            phaseStartedAt: phaseStartedAt.current,
            updatedAt: Date.now(),
        });
    }, [preset, phase, secondsLeft, running, completedFocusCycles]);

    /** Posts the phase that just ended, then refreshes the analytics on screen. */
    const record = useCallback(
        async (endedPhase, completed) => {
            const startedAt = phaseStartedAt.current;
            if (startedAt === null) {
                return;
            }

            const stored = await logSession({
                preset,
                phase: endedPhase,
                startedAt,
                completed,
            });

            if (stored) {
                refreshAnalytics(component);
            }
        },
        [preset, component],
    );

    const beginPhase = useCallback((chosen, nextPhaseName, shouldRun) => {
        phaseStartedAt.current = shouldRun ? Date.now() : null;
        setPhase(nextPhaseName);
        setSecondsLeft(secondsFor(chosen, nextPhaseName));
        setRunning(shouldRun);
    }, []);

    // ── The ticker ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!running) {
            return undefined;
        }

        intervalRef.current = window.setInterval(() => {
            setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
        }, 1000);

        return () => window.clearInterval(intervalRef.current);
    }, [running]);

    // The optional per-second tick. Focus only: ticking through a break is
    // the opposite of resting.
    useEffect(() => {
        if (!running || !preset || phase !== PHASE_FOCUS || secondsLeft <= 0) {
            return;
        }

        tick(preset.ticking_sound);
    }, [secondsLeft, running, preset, phase]);

    // The background bed, which follows the same focus-only rule and stops
    // the moment the timer is paused.
    useEffect(() => {
        if (running && preset && phase === PHASE_FOCUS) {
            ambience(preset.ambience);

            return;
        }

        ambience('none');
    }, [running, preset, phase]);

    // Strict mode, for as long as a focus interval is actually running. See
    // Lib/strictMode.js for what a web page can and cannot do here.
    useEffect(() => {
        if (!running || !preset?.strict_mode || phase !== PHASE_FOCUS) {
            disengageStrictMode();

            return undefined;
        }

        setLeftPageDuringFocus(false);
        engageStrictMode({ onLeave: () => setLeftPageDuringFocus(true) });

        return disengageStrictMode;
    }, [running, preset, phase]);

    // ── The roll-over ─────────────────────────────────────────────────────
    useEffect(() => {
        if (secondsLeft !== 0 || !running || preset === null) {
            return;
        }

        const endedPhase = phase;
        record(endedPhase, true);

        alarm(preset.alarm_sound);

        const next = nextPhase({ phase, completedFocusCycles }, preset);

        // No break of either length configured: the session ends after focus,
        // exactly as it did before issue #3.
        if (next === null) {
            phaseStartedAt.current = null;
            setRunning(false);
            notify('Focus session done', {
                body: `${preset.name} finished.`,
                tag: ALERT_TAGS.pomodoro,
            });

            return;
        }

        setCompletedFocusCycles(next.completedFocusCycles);
        beginPhase(preset, next.phase, next.autoStart);

        notify(
            `${phaseLabel(endedPhase)} done — ${phaseLabel(next.phase).toLowerCase()}`,
            {
                body: next.autoStart
                    ? `${phaseMessage(next.phase)}. Started automatically.`
                    : `${phaseMessage(next.phase)}. Press start when you are ready.`,
                tag: ALERT_TAGS.pomodoro,
            },
        );
    }, [
        secondsLeft,
        running,
        phase,
        preset,
        completedFocusCycles,
        record,
        beginPhase,
    ]);

    useEffect(() => stopAll, []);

    // ── Controls ──────────────────────────────────────────────────────────
    const start = useCallback(
        (chosen) => {
            setPreset(chosen);
            setCompletedFocusCycles(0);
            setLeftPageDuringFocus(false);
            beginPhase(chosen, PHASE_FOCUS, true);
        },
        [beginPhase],
    );

    /** Load a preset onto the clock without starting it, for the preset picker. */
    const select = useCallback(
        (chosen) => {
            setPreset(chosen);
            setCompletedFocusCycles(0);
            beginPhase(chosen, PHASE_FOCUS, false);
        },
        [beginPhase],
    );

    const stop = useCallback(() => {
        if (running) {
            record(phase, false);
        }

        phaseStartedAt.current = null;
        setRunning(false);
        setSecondsLeft(0);
        setPreset(null);
        setPhase(PHASE_FOCUS);
        setCompletedFocusCycles(0);
        setLeftPageDuringFocus(false);
    }, [running, phase, record]);

    /** Back to the top of the focus phase, paused, and the set starts again. */
    const restart = useCallback(() => {
        if (preset === null) {
            return;
        }

        if (running) {
            record(phase, false);
        }

        setCompletedFocusCycles(0);
        beginPhase(preset, PHASE_FOCUS, false);
    }, [preset, running, phase, record, beginPhase]);

    /**
     * Jump to the next phase without waiting for the clock. The interval is
     * still logged - as abandoned, not completed - because "I skipped four of
     * six today" is exactly the kind of thing the analytics should show.
     */
    const skip = useCallback(() => {
        if (preset === null) {
            return;
        }

        if (running) {
            record(phase, false);
        }

        const next = nextPhase({ phase, completedFocusCycles }, preset);

        if (next === null) {
            phaseStartedAt.current = null;
            setRunning(false);
            setSecondsLeft(0);

            return;
        }

        setCompletedFocusCycles(next.completedFocusCycles);
        // Keep whatever running/paused state it was in, rather than obeying
        // the auto-start toggle: the user pressed Skip, which is already the
        // manual decision that toggle is about.
        beginPhase(preset, next.phase, running);
    }, [preset, running, phase, completedFocusCycles, record, beginPhase]);

    const pause = useCallback(() => setRunning(false), []);

    const resume = useCallback(() => {
        if (preset === null) {
            return;
        }

        // A phase resumed after a pause keeps its original start time only if
        // it had one; a phase that never ran gets its clock now, so the logged
        // duration reflects wall time rather than counting the pause.
        if (phaseStartedAt.current === null) {
            phaseStartedAt.current = Date.now();
        }

        setRunning(true);
    }, [preset]);

    return {
        preset,
        phase,
        phaseLabel: phaseLabel(phase),
        phaseMessage: phaseMessage(phase),
        onBreak: isBreak(phase),
        secondsLeft,
        totalSeconds: secondsFor(preset, phase),
        running,
        completedFocusCycles,
        cycle: cyclePosition({ phase, completedFocusCycles }, preset),
        strict: Boolean(preset?.strict_mode),
        leftPageDuringFocus,
        start,
        select,
        stop,
        restart,
        skip,
        pause,
        resume,
    };
}
