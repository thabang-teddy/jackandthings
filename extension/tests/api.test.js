import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The API client's error handling, which decides what the user is actually
 * told when something goes wrong.
 *
 * `lib/ext.js` reads the WebExtension namespace at module load, so the stub
 * has to be in place before the import — hence the dynamic import below.
 */

let store;
let fetchCalls;

globalThis.chrome = {
    storage: {
        local: {
            get: async (keys) => {
                const list = Array.isArray(keys) ? keys : [keys];
                const out = {};
                for (const key of list) if (key in store) out[key] = store[key];
                return out;
            },
            set: async (patch) => Object.assign(store, patch),
            remove: async (keys) => {
                for (const key of [].concat(keys)) delete store[key];
            },
        },
    },
    permissions: { contains: async () => true, request: async () => true },
};

const { api, ApiError } = await import('../src/lib/api.js');

function respondWith(status, body) {
    globalThis.fetch = async (url, init) => {
        fetchCalls.push({ url, init });
        return {
            ok: status >= 200 && status < 300,
            status,
            text: async () => (body === null ? '' : JSON.stringify(body)),
        };
    };
}

beforeEach(() => {
    store = { baseUrl: 'http://127.0.0.1:8000/api/v1/', token: 'test-token' };
    fetchCalls = [];
});

describe('request building', () => {
    test('joins the base URL without losing the /api/v1/ segment', async () => {
        respondWith(200, { data: [] });
        await api.notes();

        assert.equal(fetchCalls[0].url, 'http://127.0.0.1:8000/api/v1/notes');
    });

    test('tolerates a base URL with no trailing slash', async () => {
        store.baseUrl = 'http://127.0.0.1:8000/api/v1';
        respondWith(200, { data: [] });
        await api.notes();

        assert.equal(fetchCalls[0].url, 'http://127.0.0.1:8000/api/v1/notes');
    });

    test('sends the bearer token when there is one', async () => {
        respondWith(200, { data: [] });
        await api.notes();

        assert.equal(fetchCalls[0].init.headers.Authorization, 'Bearer test-token');
    });

    test('omits the Authorization header when signed out', async () => {
        delete store.token;
        respondWith(200, { data: [] });
        await api.notes();

        assert.equal(fetchCalls[0].init.headers.Authorization, undefined);
    });
});

describe('error reporting', () => {
    test('a validation error surfaces the first field message, not the generic one', async () => {
        respondWith(422, {
            message: 'The given data was invalid.',
            errors: { amount: ['That is more than the account holds.'] },
        });

        await assert.rejects(
            () => api.notes(),
            (error) => {
                assert.ok(error instanceof ApiError);
                assert.equal(error.status, 422);
                // The field message is what the user can act on.
                assert.equal(error.message, 'That is more than the account holds.');
                return true;
            },
        );
    });

    test('falls back to the top-level message when there are no field errors', async () => {
        respondWith(403, { message: 'This action is unauthorized.' });

        await assert.rejects(() => api.notes(), /This action is unauthorized/);
    });

    test('falls back to the status when the body is not JSON', async () => {
        globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => '<html>oops' });

        await assert.rejects(() => api.notes(), /HTTP 500/);
    });

    test('an unreachable server is reported as such, not as a crash', async () => {
        globalThis.fetch = async () => {
            throw new TypeError('Failed to fetch');
        };

        await assert.rejects(
            () => api.notes(),
            (error) => {
                assert.equal(error.status, 0);
                assert.match(error.message, /Could not reach/);
                return true;
            },
        );
    });

    test('a 401 clears the stored session so the UI falls back to sign-in', async () => {
        respondWith(401, { message: 'Unauthenticated.' });

        await assert.rejects(() => api.notes());
        assert.equal(store.token, undefined);
    });

    test('a failure that is not a 401 leaves the session alone', async () => {
        respondWith(422, { message: 'nope' });

        await assert.rejects(() => api.notes());
        assert.equal(store.token, 'test-token');
    });
});

describe('response shapes', () => {
    test('unwraps the data envelope', async () => {
        respondWith(200, { data: [{ id: '1', title: 'Note' }] });

        assert.deepEqual(await api.notes(), [{ id: '1', title: 'Note' }]);
    });

    test('a 204 returns nothing rather than failing to parse', async () => {
        respondWith(204, null);

        assert.equal(await api.deleteNote('1'), null);
    });

    test('history carries the retention window the add-on acts on', async () => {
        respondWith(200, { data: [{ id: '1' }], meta: { retention_days: 90 } });

        const result = await api.historyEntries();
        assert.equal(result.retentionDays, 90);
        assert.equal(result.entries.length, 1);
    });

    test('history without meta leaves the window unknown rather than guessing', async () => {
        respondWith(200, { data: [] });

        // Guessing a window here could mean deleting the wrong history.
        assert.equal((await api.historyEntries()).retentionDays, null);
    });
});
