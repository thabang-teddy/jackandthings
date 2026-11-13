import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { restartPatch, skipPatch } from '../src/popup/views/pomodoro.js';

/**
 * The phase names and the long-break cycle arrived with issue #3; before it a
 * session was focus/break only. These cover the same two pure functions, now
 * against the three-phase cycle they share with the server and the other two
 * clients.
 */

const base = {
    presetId: 'p1',
    name: 'Deep work',
    focusMinutes: 50,
    breakMinutes: 10,
    longBreakMinutes: 20,
    cyclesBeforeLongBreak: 4,
    autoStartBreaks: true,
    autoStartFocus: false,
    completedFocusCycles: 0,
};

describe('restartPatch', () => {
    test('goes back to the top of focus, paused', () => {
        const patch = restartPatch({
            ...base,
            phase: 'short_break',
            completedFocusCycles: 2,
            endsAt: 123,
            pausedRemaining: null,
        });

        assert.equal(patch.phase, 'focus');
        assert.equal(patch.pausedRemaining, 50 * 60);
        // Everything else about the session is untouched.
        assert.equal(patch.presetId, 'p1');
        assert.equal(patch.name, 'Deep work');
    });

    test('starts the set again, so the long break is not half-counted', () => {
        const patch = restartPatch({ ...base, phase: 'focus', completedFocusCycles: 3 });

        assert.equal(patch.completedFocusCycles, 0);
    });

    test('pauses it even if it was running', () => {
        const running = { ...base, phase: 'focus', pausedRemaining: null };

        assert.equal(restartPatch(running).pausedRemaining, 50 * 60);
    });
});

describe('skipPatch', () => {
    const now = 1_700_000_000_000;

    test('from focus with a break jumps to a full short break, still running', () => {
        const patch = skipPatch({ ...base, phase: 'focus', pausedRemaining: null }, now);

        assert.equal(patch.phase, 'short_break');
        assert.equal(patch.pausedRemaining, null);
        assert.equal(patch.endsAt, now + 10 * 60_000);
        assert.equal(patch.completedFocusCycles, 1);
    });

    test('the fourth focus run leads into the long break, not the short one', () => {
        const patch = skipPatch(
            { ...base, phase: 'focus', completedFocusCycles: 3, pausedRemaining: null },
            now,
        );

        assert.equal(patch.phase, 'long_break');
        assert.equal(patch.endsAt, now + 20 * 60_000);
        assert.equal(patch.completedFocusCycles, 4);
    });

    test('a long break closes the set, so counting starts again', () => {
        const patch = skipPatch(
            { ...base, phase: 'long_break', completedFocusCycles: 4, pausedRemaining: null },
            now,
        );

        assert.equal(patch.phase, 'focus');
        assert.equal(patch.completedFocusCycles, 0);
    });

    test('a preset with no long break takes the short one every time', () => {
        const patch = skipPatch(
            {
                ...base,
                longBreakMinutes: 0,
                phase: 'focus',
                completedFocusCycles: 3,
                pausedRemaining: null,
            },
            now,
        );

        assert.equal(patch.phase, 'short_break');
    });

    test('from a break goes back to a full focus phase', () => {
        const patch = skipPatch({ ...base, phase: 'short_break', pausedRemaining: null }, now);

        assert.equal(patch.phase, 'focus');
        assert.equal(patch.endsAt, now + 50 * 60_000);
    });

    test('a focus session with no break of either length has nothing to skip into', () => {
        const pomodoro = {
            ...base,
            breakMinutes: 0,
            longBreakMinutes: 0,
            phase: 'focus',
            pausedRemaining: null,
        };

        assert.equal(skipPatch(pomodoro, now), null);
    });

    test('while paused, the new phase is paused too rather than resuming it', () => {
        // pausedRemaining non-null is what "paused" means here.
        const pomodoro = { ...base, phase: 'focus', pausedRemaining: 900 };

        const patch = skipPatch(pomodoro, now);

        assert.equal(patch.phase, 'short_break');
        assert.equal(patch.pausedRemaining, 10 * 60);
        assert.equal(patch.endsAt, null);
    });
});
