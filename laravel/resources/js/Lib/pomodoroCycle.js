/**
 * The pure rules of a Pomodoro cycle: how long each phase runs, what follows
 * what, and whether the next phase starts on its own.
 *
 * Kept free of React, storage, audio and the network on purpose, the same way
 * the add-on pulled restartPatch/skipPatch out of its popup: this is the part
 * worth pinning with tests, and it is also the part the Kotlin engine and the
 * add-on have to agree with exactly. If the three surfaces ever disagree
 * about when the long break falls, this file is the reference.
 */

export const PHASE_FOCUS = 'focus';
export const PHASE_SHORT_BREAK = 'short_break';
export const PHASE_LONG_BREAK = 'long_break';

/** Mirrors App\Enums\PomodoroPhase on the server. */
export const PHASES = [PHASE_FOCUS, PHASE_SHORT_BREAK, PHASE_LONG_BREAK];

const LABELS = {
    [PHASE_FOCUS]: 'Focus',
    [PHASE_SHORT_BREAK]: 'Short break',
    [PHASE_LONG_BREAK]: 'Long break',
};

const MESSAGES = {
    [PHASE_FOCUS]: 'Time to focus',
    [PHASE_SHORT_BREAK]: 'Take a short break',
    [PHASE_LONG_BREAK]: 'Take a proper break',
};

export function phaseLabel(phase) {
    return LABELS[phase] ?? LABELS[PHASE_FOCUS];
}

export function phaseMessage(phase) {
    return MESSAGES[phase] ?? MESSAGES[PHASE_FOCUS];
}

export function isBreak(phase) {
    return phase === PHASE_SHORT_BREAK || phase === PHASE_LONG_BREAK;
}

/**
 * Minutes a phase runs for this preset. Falls back to the classic 25/5/15
 * when a field is missing, so a preset written by an older client - or a
 * localStorage entry saved before issue #3 - still produces a sane timer
 * rather than a zero-length phase.
 */
export function minutesFor(preset, phase) {
    if (!preset) {
        return 0;
    }

    if (phase === PHASE_LONG_BREAK) {
        return Number(preset.long_break_minutes ?? 15);
    }

    if (phase === PHASE_SHORT_BREAK) {
        return Number(preset.break_minutes ?? 5);
    }

    return Number(preset.focus_minutes ?? 25);
}

export function secondsFor(preset, phase) {
    return Math.max(Math.round(minutesFor(preset, phase) * 60), 0);
}

/** How many focus intervals precede a long break; at least one. */
export function cycleLength(preset) {
    return Math.max(Number(preset?.cycles_before_long_break ?? 4), 1);
}

/**
 * Which break follows a focus interval, given how many focus intervals have
 * been completed *including* the one just finished. The long break lands on
 * every nth completion, and is skipped entirely when the preset sets its
 * length to zero - in which case the short break takes its place.
 */
export function breakAfter(preset, completedFocusCycles) {
    const longEvery = cycleLength(preset);
    const wantsLong =
        completedFocusCycles > 0 && completedFocusCycles % longEvery === 0;

    if (wantsLong && minutesFor(preset, PHASE_LONG_BREAK) > 0) {
        return PHASE_LONG_BREAK;
    }

    return minutesFor(preset, PHASE_SHORT_BREAK) > 0 ? PHASE_SHORT_BREAK : null;
}

/**
 * What comes after the current phase.
 *
 * Returns `{ phase, completedFocusCycles, autoStart }`, or null when the
 * session has nowhere to go - a focus-only preset with no break of either
 * length, which ends after focus exactly as it did before issue #3.
 *
 * `autoStart` reads the preset's two toggles rather than deciding for itself,
 * which is the whole point of the Auto-Start option: `auto_start_breaks`
 * governs rolling into a break, `auto_start_focus` governs rolling back into
 * work. Both default to the traditional behaviour - breaks begin on their
 * own, the next work interval waits for you.
 */
export function nextPhase({ phase, completedFocusCycles = 0 }, preset) {
    if (!preset) {
        return null;
    }

    if (phase === PHASE_FOCUS) {
        const completed = completedFocusCycles + 1;
        const next = breakAfter(preset, completed);

        if (next === null) {
            return null;
        }

        return {
            phase: next,
            completedFocusCycles: completed,
            autoStart: preset.auto_start_breaks !== false,
        };
    }

    return {
        phase: PHASE_FOCUS,
        // A long break closes the set, so the count starts again from it.
        completedFocusCycles:
            phase === PHASE_LONG_BREAK ? 0 : completedFocusCycles,
        autoStart: preset.auto_start_focus === true,
    };
}

/**
 * Where the current focus interval sits in the set, 1-based, for the "3 of 4"
 * indicator. A break reports the interval it follows, so the number does not
 * jump forward while you are resting.
 */
export function cyclePosition({ phase, completedFocusCycles = 0 }, preset) {
    const length = cycleLength(preset);

    if (phase === PHASE_FOCUS) {
        return { index: (completedFocusCycles % length) + 1, length };
    }

    const completed = completedFocusCycles % length;

    return { index: completed === 0 ? length : completed, length };
}
