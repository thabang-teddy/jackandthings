import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { restartPatch, skipPatch } from '../src/popup/views/pomodoro.js';

describe('restartPatch', () => {
    test('goes back to the top of focus, paused', () => {
        const pomodoro = {
            presetId: 'p1',
            name: 'Deep work',
            phase: 'break',
            focusMinutes: 50,
            breakMinutes: 10,
            endsAt: 123,
            pausedRemaining: null,
        };

        const patch = restartPatch(pomodoro);

        assert.equal(patch.phase, 'focus');
        assert.equal(patch.pausedRemaining, 50 * 60);
        // Everything else about the session is untouched.
        assert.equal(patch.presetId, 'p1');
        assert.equal(patch.name, 'Deep work');
    });

    test('pauses it even if it was running', () => {
        const running = { phase: 'focus', focusMinutes: 25, breakMinutes: 5, pausedRemaining: null };

        assert.equal(restartPatch(running).pausedRemaining, 25 * 60);
    });
});

describe('skipPatch', () => {
    const now = 1_700_000_000_000;

    test('from focus with a break jumps to a full break, still running', () => {
        const pomodoro = {
            phase: 'focus',
            focusMinutes: 25,
            breakMinutes: 5,
            pausedRemaining: null,
        };

        const patch = skipPatch(pomodoro, now);

        assert.equal(patch.phase, 'break');
        assert.equal(patch.pausedRemaining, null);
        assert.equal(patch.endsAt, now + 5 * 60_000);
    });

    test('from break goes back to a full focus phase', () => {
        const pomodoro = {
            phase: 'break',
            focusMinutes: 25,
            breakMinutes: 5,
            pausedRemaining: null,
        };

        const patch = skipPatch(pomodoro, now);

        assert.equal(patch.phase, 'focus');
        assert.equal(patch.endsAt, now + 25 * 60_000);
    });

    test('a focus session with no break has nothing to skip into', () => {
        const pomodoro = { phase: 'focus', focusMinutes: 25, breakMinutes: 0, pausedRemaining: null };

        assert.equal(skipPatch(pomodoro, now), null);
    });

    test('while paused, the new phase is paused too rather than resuming it', () => {
        // pausedRemaining non-null is what "paused" means here.
        const pomodoro = { phase: 'focus', focusMinutes: 25, breakMinutes: 5, pausedRemaining: 900 };

        const patch = skipPatch(pomodoro, now);

        assert.equal(patch.phase, 'break');
        assert.equal(patch.pausedRemaining, 5 * 60);
        assert.equal(patch.endsAt, undefined);
    });
});
