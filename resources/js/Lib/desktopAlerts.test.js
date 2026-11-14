import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
    ALERT_TAGS,
    alertPermission,
    alertsEnabled,
    alertsSupported,
    notify,
} from './desktopAlerts.js';

const STORAGE_KEY = 'jackandthings:desktop-alerts';

/**
 * Stands in for the browser. The module reads `window` at call time rather
 * than on import, which is what lets a plain Node test drive it without a
 * DOM - and is also what lets the page react to a permission granted after
 * it loaded.
 */
function fakeWindow({ permission = 'default', storage = true } = {}) {
    const shown = [];
    const store = new Map();

    const win = {
        Notification: class {
            constructor(title, options = {}) {
                shown.push({ title, ...options });
            }

            static permission = permission;
        },
        localStorage: storage
            ? {
                  getItem: (key) => (store.has(key) ? store.get(key) : null),
                  setItem: (key, value) => store.set(key, String(value)),
              }
            : // A browser with site data blocked throws on access rather
              // than returning null, which is the case worth covering.
              {
                  getItem: () => {
                      throw new Error('storage disabled');
                  },
                  setItem: () => {
                      throw new Error('storage disabled');
                  },
              },
    };

    return { win, shown, store };
}

function install({ permission, storage, preference } = {}) {
    const fake = fakeWindow({ permission, storage });
    if (preference !== undefined && storage !== false) {
        fake.store.set(STORAGE_KEY, preference);
    }
    globalThis.window = fake.win;
    return fake;
}

afterEach(() => {
    delete globalThis.window;
});

describe('alertsSupported', () => {
    it('is false where the browser has no Notification at all', () => {
        globalThis.window = {};
        assert.equal(alertsSupported(), false);
    });

    it('is true once Notification exists', () => {
        install();
        assert.equal(alertsSupported(), true);
    });
});

describe('alertPermission', () => {
    it('reports what the browser says', () => {
        install({ permission: 'granted' });
        assert.equal(alertPermission(), 'granted');

        install({ permission: 'denied' });
        assert.equal(alertPermission(), 'denied');
    });

    it('is unsupported rather than denied when there is no Notification', () => {
        globalThis.window = {};
        assert.equal(alertPermission(), 'unsupported');
    });
});

describe('alertsEnabled', () => {
    it('needs both the permission and the preference', () => {
        install({ permission: 'granted', preference: 'on' });
        assert.equal(alertsEnabled(), true);
    });

    it('is off when the browser allowed it but the user turned it off', () => {
        install({ permission: 'granted', preference: 'off' });
        assert.equal(alertsEnabled(), false);
    });

    it('is off when the user wants it but the browser refused', () => {
        install({ permission: 'denied', preference: 'on' });
        assert.equal(alertsEnabled(), false);
    });

    it('is off before anything has been chosen', () => {
        install({ permission: 'default' });
        assert.equal(alertsEnabled(), false);
    });

    it('is off, not broken, when storage throws', () => {
        install({ permission: 'granted', storage: false });
        assert.equal(alertsEnabled(), false);
    });
});

describe('notify', () => {
    it('shows the notification when alerts are on', () => {
        const { shown } = install({ permission: 'granted', preference: 'on' });

        const result = notify('No workout logged this hour', {
            body: 'Log what you have done.',
            tag: ALERT_TAGS.workoutDue,
        });

        assert.equal(result, true);
        assert.deepEqual(shown, [
            {
                title: 'No workout logged this hour',
                body: 'Log what you have done.',
                tag: 'jack-workout-due',
            },
        ]);
    });

    it('does nothing at all when alerts are off', () => {
        const { shown } = install({ permission: 'granted', preference: 'off' });

        assert.equal(notify('Quiet', { body: 'Nothing' }), false);
        assert.deepEqual(shown, []);
    });

    it('does nothing when the browser refused permission', () => {
        const { shown } = install({ permission: 'denied', preference: 'on' });

        assert.equal(notify('Quiet', {}), false);
        assert.deepEqual(shown, []);
    });

    it('swallows a browser that throws rather than breaking the page', () => {
        install({ permission: 'granted', preference: 'on' });
        globalThis.window.Notification = class {
            constructor() {
                throw new Error('not allowed in this context');
            }

            static permission = 'granted';
        };

        assert.equal(notify('Boom', {}), false);
    });

    it('tags the two kinds apart so one never replaces the other', () => {
        assert.notEqual(ALERT_TAGS.workoutDue, ALERT_TAGS.pomodoro);
    });
});
