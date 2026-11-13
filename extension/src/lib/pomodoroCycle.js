/**
 * The pure rules of a Pomodoro cycle: how long each phase runs, what follows
 * what, and whether the next phase starts on its own.
 *
 * The third copy of a rule set all three surfaces have to agree on exactly -
 * the others are laravel/resources/js/Lib/pomodoroCycle.js and
 * android/.../pomodoro/PomodoroCycle.kt. If they ever disagree about when the
 * long break falls, those three files are where to look.
 *
 * Free of chrome.*, storage and timers on purpose, the same way restartPatch
 * and skipPatch were pulled out of the popup: this is the part worth testing
 * without a browser.
 */

export const PHASE_FOCUS = 'focus';
export const PHASE_SHORT_BREAK = 'short_break';
export const PHASE_LONG_BREAK = 'long_break';

const LABELS = {
    [PHASE_FOCUS]: 'Focus',
    [PHASE_SHORT_BREAK]: 'Short break',
    [PHASE_LONG_BREAK]: 'Long break',
};

export function phaseLabel(phase) {
    return LABELS[phase] ?? LABELS[PHASE_FOCUS];
}

export function isBreak(phase) {
    return phase === PHASE_SHORT_BREAK || phase === PHASE_LONG_BREAK;
}

/**
 * Minutes a phase runs for this session.
 *
 * Reads the flattened shape the popup stores (focusMinutes, breakMinutes,
 * longBreakMinutes) rather than a server preset, because that is what
 * survives in chrome.storage between popup openings. Falls back to the
 * classic 25/5/15 so a session stored before issue #3 still produces a sane
 * timer rather than a zero-length phase.
 */
export function minutesFor(session, phase) {
    if (!session) return 0;

    if (phase === PHASE_LONG_BREAK) return Number(session.longBreakMinutes ?? 15);
    if (phase === PHASE_SHORT_BREAK) return Number(session.breakMinutes ?? 5);

    return Number(session.focusMinutes ?? 25);
}

export function secondsFor(session, phase) {
    return Math.max(Math.round(minutesFor(session, phase) * 60), 0);
}

/** How many focus runs precede a long break; at least one. */
export function cycleLength(session) {
    return Math.max(Number(session?.cyclesBeforeLongBreak ?? 4), 1);
}

/**
 * Which break follows a focus run, given how many runs are complete
 * *including* the one that just ended. Null means there is no break of either
 * length to take, so the session ends after focus.
 */
export function breakAfter(session, completedFocusCycles) {
    const wantsLong =
        completedFocusCycles > 0 && completedFocusCycles % cycleLength(session) === 0;

    if (wantsLong && minutesFor(session, PHASE_LONG_BREAK) > 0) return PHASE_LONG_BREAK;

    return minutesFor(session, PHASE_SHORT_BREAK) > 0 ? PHASE_SHORT_BREAK : null;
}

/**
 * What comes after the current phase, or null when the session has nowhere to
 * go - a focus-only preset with no break of either length.
 *
 * `autoStart` reads the session's two toggles rather than deciding for
 * itself: `autoStartBreaks` governs rolling into a break, `autoStartFocus`
 * governs rolling back into work.
 */
export function nextPhase(session) {
    if (!session) return null;

    const completed = session.completedFocusCycles ?? 0;

    if (session.phase === PHASE_FOCUS) {
        const total = completed + 1;
        const phase = breakAfter(session, total);
        if (phase === null) return null;

        return {
            phase,
            completedFocusCycles: total,
            autoStart: session.autoStartBreaks !== false,
        };
    }

    return {
        phase: PHASE_FOCUS,
        // A long break closes the set, so counting starts again from it.
        completedFocusCycles: session.phase === PHASE_LONG_BREAK ? 0 : completed,
        autoStart: session.autoStartFocus === true,
    };
}

/**
 * Where the current focus run sits in the set, 1-based, for the "3 of 4"
 * indicator. A break reports the run it follows, so the number does not jump
 * forward while you are resting.
 */
export function cyclePosition(session) {
    const length = cycleLength(session);
    const completed = session?.completedFocusCycles ?? 0;

    if (session?.phase === PHASE_FOCUS) {
        return { index: (completed % length) + 1, length };
    }

    const within = completed % length;

    return { index: within === 0 ? length : within, length };
}

/**
 * The stored session shape, from a server preset. Flattened rather than
 * holding the preset itself, because the alarm handler reads this out of
 * storage long after the popup that created it is gone.
 */
export function sessionFromPreset(preset, now = Date.now()) {
    return {
        presetId: preset.id,
        name: preset.name,
        tag: preset.tag ?? null,
        phase: PHASE_FOCUS,
        focusMinutes: preset.focus_minutes,
        breakMinutes: preset.break_minutes,
        longBreakMinutes: preset.long_break_minutes ?? 15,
        cyclesBeforeLongBreak: preset.cycles_before_long_break ?? 4,
        autoStartBreaks: preset.auto_start_breaks !== false,
        autoStartFocus: preset.auto_start_focus === true,
        alarmSound: preset.alarm_sound ?? 'chime',
        tickingSound: preset.ticking_sound ?? 'none',
        ambience: preset.ambience ?? 'none',
        strictMode: preset.strict_mode === true,
        blockedSites: preset.blocked_sites ?? [],
        completedFocusCycles: 0,
        endsAt: now + preset.focus_minutes * 60_000,
        startedAt: now,
        pausedRemaining: null,
    };
}
