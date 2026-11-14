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

describe('budget api', () => {
    test('the monthly caps are read for one period', async () => {
        respondWith(200, { data: [{ id: 'l1', category: 'Groceries', limit_cents: 30000, spent_cents: 12000 }] });

        assert.deepEqual(await api.budgetLimits('2026-11'), [
            { id: 'l1', category: 'Groceries', limit_cents: 30000, spent_cents: 12000 },
        ]);
        assert.equal(fetchCalls[0].url, 'http://127.0.0.1:8000/api/v1/budget-limits?period=2026-11');
    });

    test('categories are read through the same envelope', async () => {
        respondWith(200, { data: [{ id: 'c1', name: 'Groceries', kind: 'expense' }] });

        assert.deepEqual(await api.budgetCategories(), [{ id: 'c1', name: 'Groceries', kind: 'expense' }]);
        assert.equal(fetchCalls[0].url, 'http://127.0.0.1:8000/api/v1/budget-categories');
    });

    test('posting a transaction sends the issue #5 columns only when they are present', async () => {
        respondWith(201, { data: { id: 't1', amount_cents: 12550, occurred_on: '2026-11-14' } });

        await api.createTransaction(
            'acc1',
            'withdrawal',
            '125.50',
            null,
            { occurredOn: '2026-11-14', merchant: 'Woolworths', categoryId: 'cat1' },
        );

        const body = JSON.parse(fetchCalls[0].init.body);
        assert.equal(body.account_id, 'acc1');
        assert.equal(body.type, 'withdrawal');
        assert.equal(body.amount, '125.50');
        assert.equal(body.occurred_on, '2026-11-14');
        assert.equal(body.merchant, 'Woolworths');
        assert.equal(body.category_id, 'cat1');
    });

    test('a plain ledger post keeps the old body and adds none of the optional columns', async () => {
        respondWith(201, { data: { id: 't1' } });

        await api.createTransaction('acc1', 'deposit', '50', 'Saved up');

        const body = JSON.parse(fetchCalls[0].init.body);
        assert.equal(body.account_id, 'acc1');
        assert.equal(body.type, 'deposit');
        assert.equal(body.amount, '50');
        assert.equal(body.description, 'Saved up');
        // The server defaults occurred_on to today and treats an absent category
        // as uncategorised, so sending empty strings would be a regression.
        assert.equal('occurred_on' in body, false);
        assert.equal('merchant' in body, false);
        assert.equal('category_id' in body, false);
    });
});
