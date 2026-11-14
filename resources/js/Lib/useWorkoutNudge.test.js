import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { alreadyNudged, currentHour, markNudged } from './useWorkoutNudge.js';

const STORAGE_KEY = 'jackandthings:workout-nudged-hour';

function installStorage({ working = true } = {}) {
    const store = new Map();

    globalThis.window = {
        localStorage: working
            ? {
                  getItem: (key) => (store.has(key) ? store.get(key) : null),
                  setItem: (key, value) => store.set(key, String(value)),
              }
            : {
                  getItem: () => {
                      throw new Error('storage disabled');
                  },
                  setItem: () => {
                      throw new Error('storage disabled');
                  },
              },
    };

    return store;
}

afterEach(() => {
    delete globalThis.window;
});

describe('currentHour', () => {
    it('is the same key anywhere inside one clock hour', () => {
        const early = new Date(2026, 10, 12, 14, 0, 0);
        const late = new Date(2026, 10, 12, 14, 59, 59);

        assert.equal(currentHour(early), currentHour(late));
    });

    it('changes on the hour', () => {
        const before = new Date(2026, 10, 12, 14, 59, 59);
        const after = new Date(2026, 10, 12, 15, 0, 0);

        assert.notEqual(currentHour(before), currentHour(after));
    });

    it('tells the same hour on different days apart', () => {
        const today = new Date(2026, 10, 12, 14, 30, 0);
        const tomorrow = new Date(2026, 10, 13, 14, 30, 0);

        assert.notEqual(currentHour(today), currentHour(tomorrow));
    });
});

describe('the once-per-hour dedupe', () => {
    it('says no before anything has been nudged', () => {
        installStorage();
        assert.equal(alreadyNudged(currentHour()), false);
    });

    it('says yes for the hour that was marked', () => {
        installStorage();
        const hour = currentHour();

        markNudged(hour);

        assert.equal(alreadyNudged(hour), true);
    });

    /**
     * The reason this lives in storage at all: the home page and
     * AuthenticatedLayout mount the hook from different components, so
     * moving between them remounts it. A value held in a ref would reset
     * and nudge again on every navigation.
     */
    it('survives what a remount would throw away', () => {
        const store = installStorage();
        const hour = currentHour();
        markNudged(hour);

        // A fresh mount reads the same storage rather than fresh state.
        globalThis.window = {
            localStorage: {
                getItem: (key) => (store.has(key) ? store.get(key) : null),
                setItem: (key, value) => store.set(key, String(value)),
            },
        };

        assert.equal(alreadyNudged(hour), true);
    });

    it('lets the next hour through', () => {
        installStorage();
        markNudged(currentHour(new Date(2026, 10, 12, 14, 30, 0)));

        assert.equal(
            alreadyNudged(currentHour(new Date(2026, 10, 12, 15, 30, 0))),
            false,
        );
    });

    it('stays quiet rather than nudging on every poll when storage throws', () => {
        installStorage({ working: false });

        // Without storage the dedupe is impossible, so the safe answer is
        // "already done" - a nudge that never fires beats one every poll.
        assert.equal(alreadyNudged(currentHour()), true);
    });

    it('marking is harmless when storage throws', () => {
        installStorage({ working: false });

        assert.doesNotThrow(() => markNudged(currentHour()));
    });

    it('uses its own storage key', () => {
        const store = installStorage();
        const hour = currentHour();

        markNudged(hour);

        assert.equal(store.get(STORAGE_KEY), hour);
    });
});
