import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    PHASE_FOCUS,
    PHASE_LONG_BREAK,
    PHASE_SHORT_BREAK,
    breakAfter,
    cycleLength,
    cyclePosition,
    isBreak,
    minutesFor,
    nextPhase,
    phaseLabel,
    secondsFor,
} from './pomodoroCycle.js';

/**
 * The cycle rules, which the Kotlin and add-on copies have to match exactly.
 *
 * This file is the reference the other two are checked against — the same
 * cases exist in android/.../PomodoroCycleTest.kt and
 * extension/tests/pomodoroCycle.test.js. If the three ever disagree about
 * when the long break falls, one of these three will say so.
 */

const classic = {
    focus_minutes: 25,
    break_minutes: 5,
    long_break_minutes: 15,
    cycles_before_long_break: 4,
    auto_start_breaks: true,
    auto_start_focus: false,
};

describe('durations', () => {
    test('each phase reads its own column', () => {
        assert.equal(minutesFor(classic, PHASE_FOCUS), 25);
        assert.equal(minutesFor(classic, PHASE_SHORT_BREAK), 5);
        assert.equal(minutesFor(classic, PHASE_LONG_BREAK), 15);
    });

    test('seconds are minutes, and never negative', () => {
        assert.equal(secondsFor(classic, PHASE_FOCUS), 1500);
        assert.equal(
            secondsFor({ ...classic, break_minutes: -5 }, PHASE_SHORT_BREAK),
            0,
        );
    });

    test('a preset written before the long break existed still runs', () => {
        // A localStorage entry saved before issue #3, or an older client's
        // preset: the missing fields fall back to the classic 25/5/15 rather
        // than producing a zero-length phase.
        const old = { focus_minutes: 50, break_minutes: 10 };

        assert.equal(minutesFor(old, PHASE_LONG_BREAK), 15);
        assert.equal(cycleLength(old), 4);
    });

    test('there is no preset at all', () => {
        // The timer calls these with no preset selected, so they have to
        // answer rather than throw. The guard inside nextPhase was
        // unreachable until the state parameter got a default — the
        // destructure in the signature fired first.
        assert.equal(minutesFor(null, PHASE_FOCUS), 0);
        assert.equal(nextPhase({ phase: PHASE_FOCUS }, null), null);
        assert.equal(nextPhase(undefined, null), null);

        // Not asserting which position it reports — with no preset there is
        // no set to be in, and nothing renders it. What matters is that it
        // answers with a usable shape instead of throwing.
        const position = cyclePosition(undefined, null);
        assert.equal(typeof position.index, 'number');
        assert.equal(typeof position.length, 'number');
    });
});

describe('which break follows a focus run', () => {
    test('a short break on the runs that are not the fourth', () => {
        assert.equal(breakAfter(classic, 1), PHASE_SHORT_BREAK);
        assert.equal(breakAfter(classic, 2), PHASE_SHORT_BREAK);
        assert.equal(breakAfter(classic, 3), PHASE_SHORT_BREAK);
    });

    test('the long break lands on every fourth run', () => {
        assert.equal(breakAfter(classic, 4), PHASE_LONG_BREAK);
        assert.equal(breakAfter(classic, 8), PHASE_LONG_BREAK);
    });

    test('a preset with no long break takes the short one every time', () => {
        const noLong = { ...classic, long_break_minutes: 0 };

        assert.equal(breakAfter(noLong, 4), PHASE_SHORT_BREAK);
    });

    test('a preset with no break of either length has nowhere to go', () => {
        const focusOnly = {
            ...classic,
            break_minutes: 0,
            long_break_minutes: 0,
        };

        assert.equal(breakAfter(focusOnly, 1), null);
    });

    test('a cycle length below one would make every run a long break', () => {
        // Guarded, because `n % 0` is NaN and `n % 1` is always 0.
        assert.equal(
            cycleLength({ ...classic, cycles_before_long_break: 0 }),
            1,
        );
        assert.equal(
            breakAfter({ ...classic, cycles_before_long_break: 0 }, 1),
            PHASE_LONG_BREAK,
        );
    });
});

describe('nextPhase', () => {
    test('focus rolls into a short break and counts the run', () => {
        const next = nextPhase(
            { phase: PHASE_FOCUS, completedFocusCycles: 0 },
            classic,
        );

        assert.equal(next.phase, PHASE_SHORT_BREAK);
        assert.equal(next.completedFocusCycles, 1);
    });

    test('the fourth focus run leads into the long break', () => {
        const next = nextPhase(
            { phase: PHASE_FOCUS, completedFocusCycles: 3 },
            classic,
        );

        assert.equal(next.phase, PHASE_LONG_BREAK);
        assert.equal(next.completedFocusCycles, 4);
    });

    test('a short break goes back to focus without disturbing the count', () => {
        const next = nextPhase(
            { phase: PHASE_SHORT_BREAK, completedFocusCycles: 2 },
            classic,
        );

        assert.equal(next.phase, PHASE_FOCUS);
        assert.equal(next.completedFocusCycles, 2);
    });

    test('a long break closes the set, so counting starts again', () => {
        const next = nextPhase(
            { phase: PHASE_LONG_BREAK, completedFocusCycles: 4 },
            classic,
        );

        assert.equal(next.phase, PHASE_FOCUS);
        assert.equal(next.completedFocusCycles, 0);
    });

    test('a focus-only preset ends rather than looping', () => {
        const focusOnly = {
            ...classic,
            break_minutes: 0,
            long_break_minutes: 0,
        };

        assert.equal(
            nextPhase(
                { phase: PHASE_FOCUS, completedFocusCycles: 0 },
                focusOnly,
            ),
            null,
        );
    });

    test('a full set runs short, short, short, long', () => {
        // The sequence end to end, which is the thing a user would actually
        // notice going wrong.
        const phases = [];
        let state = { phase: PHASE_FOCUS, completedFocusCycles: 0 };

        for (let i = 0; i < 8; i++) {
            state = nextPhase(state, classic);
            phases.push(state.phase);
        }

        assert.deepEqual(phases, [
            PHASE_SHORT_BREAK,
            PHASE_FOCUS,
            PHASE_SHORT_BREAK,
            PHASE_FOCUS,
            PHASE_SHORT_BREAK,
            PHASE_FOCUS,
            PHASE_LONG_BREAK,
            PHASE_FOCUS,
        ]);
    });
});

describe('auto-start', () => {
    test('the defaults are the traditional Pomodoro behaviour', () => {
        // A break begins on its own; going back to work is your decision.
        assert.equal(
            nextPhase({ phase: PHASE_FOCUS, completedFocusCycles: 0 }, classic)
                .autoStart,
            true,
        );
        assert.equal(
            nextPhase(
                { phase: PHASE_SHORT_BREAK, completedFocusCycles: 1 },
                classic,
            ).autoStart,
            false,
        );
    });

    test('each toggle governs its own direction', () => {
        const manualBreaks = {
            ...classic,
            auto_start_breaks: false,
            auto_start_focus: true,
        };

        assert.equal(
            nextPhase(
                { phase: PHASE_FOCUS, completedFocusCycles: 0 },
                manualBreaks,
            ).autoStart,
            false,
        );
        assert.equal(
            nextPhase(
                { phase: PHASE_SHORT_BREAK, completedFocusCycles: 1 },
                manualBreaks,
            ).autoStart,
            true,
        );
    });

    test('a preset missing the flags still auto-starts breaks only', () => {
        const old = { focus_minutes: 25, break_minutes: 5 };

        assert.equal(
            nextPhase({ phase: PHASE_FOCUS, completedFocusCycles: 0 }, old)
                .autoStart,
            true,
        );
        assert.equal(
            nextPhase(
                { phase: PHASE_SHORT_BREAK, completedFocusCycles: 1 },
                old,
            ).autoStart,
            false,
        );
    });
});

describe('cyclePosition', () => {
    test('focus runs count from one', () => {
        assert.deepEqual(
            cyclePosition(
                { phase: PHASE_FOCUS, completedFocusCycles: 0 },
                classic,
            ),
            {
                index: 1,
                length: 4,
            },
        );
        assert.equal(
            cyclePosition(
                { phase: PHASE_FOCUS, completedFocusCycles: 2 },
                classic,
            ).index,
            3,
        );
    });

    test('a break reports the run it follows, so the number does not jump ahead', () => {
        assert.equal(
            cyclePosition(
                { phase: PHASE_SHORT_BREAK, completedFocusCycles: 1 },
                classic,
            ).index,
            1,
        );
    });

    test('the long break reports the end of the set rather than wrapping to zero', () => {
        assert.equal(
            cyclePosition(
                { phase: PHASE_LONG_BREAK, completedFocusCycles: 4 },
                classic,
            ).index,
            4,
        );
    });
});

describe('labels', () => {
    test('each phase has one, and an unknown phase degrades to focus', () => {
        assert.equal(phaseLabel(PHASE_FOCUS), 'Focus');
        assert.equal(phaseLabel(PHASE_SHORT_BREAK), 'Short break');
        assert.equal(phaseLabel(PHASE_LONG_BREAK), 'Long break');
        assert.equal(phaseLabel('napping'), 'Focus');
    });

    test('both breaks are breaks and focus is not', () => {
        assert.equal(isBreak(PHASE_SHORT_BREAK), true);
        assert.equal(isBreak(PHASE_LONG_BREAK), true);
        assert.equal(isBreak(PHASE_FOCUS), false);
    });
});
