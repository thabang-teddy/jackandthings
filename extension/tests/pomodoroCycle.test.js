import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    PHASE_FOCUS,
    PHASE_LONG_BREAK,
    PHASE_SHORT_BREAK,
    breakAfter,
    cycleLength,
    cyclePosition,
    minutesFor,
    nextPhase,
    sessionFromPreset,
} from '../src/lib/pomodoroCycle.js';

/**
 * The add-on's copy of the cycle rules.
 *
 * Deliberately the same cases as the web app's
 * laravel/resources/js/Lib/pomodoroCycle.test.js and Android's
 * PomodoroCycleTest.kt. Three implementations have to agree about when the
 * long break falls, and three test files asserting the same sequence is what
 * makes a divergence show up as a failure rather than as a user noticing
 * their phone and their browser disagreeing.
 *
 * Note the shape difference, which is real and intended: the add-on stores a
 * flattened session in chrome.storage rather than holding a server preset,
 * because the alarm that rolls a phase over runs long after the popup that
 * started it is gone.
 */

const classic = {
    phase: PHASE_FOCUS,
    focusMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4,
    autoStartBreaks: true,
    autoStartFocus: false,
    completedFocusCycles: 0,
};

describe('durations', () => {
    test('each phase reads its own field', () => {
        assert.equal(minutesFor(classic, PHASE_FOCUS), 25);
        assert.equal(minutesFor(classic, PHASE_SHORT_BREAK), 5);
        assert.equal(minutesFor(classic, PHASE_LONG_BREAK), 15);
    });

    test('a session stored before issue #3 still runs', () => {
        const old = { focusMinutes: 50, breakMinutes: 10 };

        assert.equal(minutesFor(old, PHASE_LONG_BREAK), 15);
        assert.equal(cycleLength(old), 4);
    });

    test('there is no session at all', () => {
        assert.equal(minutesFor(null, PHASE_FOCUS), 0);
        assert.equal(nextPhase(null), null);
    });
});

describe('which break follows a focus run', () => {
    test('a short break on the runs that are not the fourth', () => {
        assert.equal(breakAfter(classic, 1), PHASE_SHORT_BREAK);
        assert.equal(breakAfter(classic, 3), PHASE_SHORT_BREAK);
    });

    test('the long break lands on every fourth run', () => {
        assert.equal(breakAfter(classic, 4), PHASE_LONG_BREAK);
        assert.equal(breakAfter(classic, 8), PHASE_LONG_BREAK);
    });

    test('a session with no long break takes the short one every time', () => {
        assert.equal(breakAfter({ ...classic, longBreakMinutes: 0 }, 4), PHASE_SHORT_BREAK);
    });

    test('a session with no break of either length has nowhere to go', () => {
        assert.equal(breakAfter({ ...classic, breakMinutes: 0, longBreakMinutes: 0 }, 1), null);
    });

    test('a cycle length below one is clamped', () => {
        assert.equal(cycleLength({ ...classic, cyclesBeforeLongBreak: 0 }), 1);
    });
});

describe('nextPhase', () => {
    test('a full set runs short, short, short, long', () => {
        // The same sequence the other two surfaces assert.
        const phases = [];
        let session = { ...classic };

        for (let i = 0; i < 8; i++) {
            const next = nextPhase(session);
            phases.push(next.phase);
            session = {
                ...session,
                phase: next.phase,
                completedFocusCycles: next.completedFocusCycles,
            };
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

    test('a long break closes the set, so counting starts again', () => {
        const next = nextPhase({
            ...classic,
            phase: PHASE_LONG_BREAK,
            completedFocusCycles: 4,
        });

        assert.equal(next.phase, PHASE_FOCUS);
        assert.equal(next.completedFocusCycles, 0);
    });

    test('a focus-only session ends rather than looping', () => {
        const focusOnly = { ...classic, breakMinutes: 0, longBreakMinutes: 0 };

        assert.equal(nextPhase(focusOnly), null);
    });

    test('the auto-start defaults are the traditional behaviour', () => {
        assert.equal(nextPhase(classic).autoStart, true);
        assert.equal(
            nextPhase({ ...classic, phase: PHASE_SHORT_BREAK, completedFocusCycles: 1 }).autoStart,
            false,
        );
    });

    test('each toggle governs its own direction', () => {
        const flipped = { ...classic, autoStartBreaks: false, autoStartFocus: true };

        assert.equal(nextPhase(flipped).autoStart, false);
        assert.equal(
            nextPhase({ ...flipped, phase: PHASE_SHORT_BREAK, completedFocusCycles: 1 }).autoStart,
            true,
        );
    });
});

describe('cyclePosition', () => {
    test('focus runs count from one and a break reports the run it follows', () => {
        assert.deepEqual(cyclePosition(classic), { index: 1, length: 4 });
        assert.equal(cyclePosition({ ...classic, completedFocusCycles: 2 }).index, 3);
        assert.equal(
            cyclePosition({ ...classic, phase: PHASE_SHORT_BREAK, completedFocusCycles: 1 }).index,
            1,
        );
    });

    test('the long break reports the end of the set rather than wrapping to zero', () => {
        assert.equal(
            cyclePosition({ ...classic, phase: PHASE_LONG_BREAK, completedFocusCycles: 4 }).index,
            4,
        );
    });
});

describe('sessionFromPreset', () => {
    const preset = {
        id: 'p1',
        name: 'Deep work',
        tag: 'Coding',
        focus_minutes: 50,
        break_minutes: 10,
        long_break_minutes: 20,
        cycles_before_long_break: 3,
        auto_start_breaks: false,
        auto_start_focus: true,
        alarm_sound: 'bell',
        ticking_sound: 'soft',
        ambience: 'rain',
        strict_mode: true,
        blocked_sites: ['news.ycombinator.com'],
    };

    test('a server preset flattens into a storable session', () => {
        const now = 1_700_000_000_000;
        const session = sessionFromPreset(preset, now);

        assert.equal(session.presetId, 'p1');
        assert.equal(session.focusMinutes, 50);
        assert.equal(session.longBreakMinutes, 20);
        assert.equal(session.cyclesBeforeLongBreak, 3);
        assert.equal(session.autoStartBreaks, false);
        assert.equal(session.autoStartFocus, true);
        assert.equal(session.tag, 'Coding');
        assert.equal(session.alarmSound, 'bell');
        assert.equal(session.strictMode, true);
        assert.deepEqual(session.blockedSites, ['news.ycombinator.com']);
    });

    test('it starts on focus, at the top of the set, running', () => {
        const now = 1_700_000_000_000;
        const session = sessionFromPreset(preset, now);

        assert.equal(session.phase, PHASE_FOCUS);
        assert.equal(session.completedFocusCycles, 0);
        assert.equal(session.pausedRemaining, null);
        assert.equal(session.startedAt, now);
        assert.equal(session.endsAt, now + 50 * 60_000);
    });

    test('a preset from an older server fills the missing fields in', () => {
        // The add-on can point at any server the user configures, including
        // one that predates issue #3.
        const session = sessionFromPreset({
            id: 'p2',
            name: 'Old',
            focus_minutes: 25,
            break_minutes: 5,
        });

        assert.equal(session.longBreakMinutes, 15);
        assert.equal(session.cyclesBeforeLongBreak, 4);
        assert.equal(session.autoStartBreaks, true);
        assert.equal(session.autoStartFocus, false);
        assert.equal(session.strictMode, false);
        assert.deepEqual(session.blockedSites, []);
        assert.equal(session.tag, null);
    });
});
