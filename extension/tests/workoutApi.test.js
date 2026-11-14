import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The fitness-tracking half of the API client.
 *
 * The add-on and the server have to agree on paths and wire field names, and
 * nothing else checks that agreement - a renamed endpoint or a camelCased
 * field would fail silently in a popup nobody is watching. These assert the
 * requests that go out, not the server's replies.
 *
 * Same harness as api.test.js: `lib/ext.js` reads the WebExtension namespace
 * at module load, so the stub goes in before the dynamic import.
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

const { api } = await import('../src/lib/api.js');

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

describe('the exercise library', () => {
    test('it reads the catalog and the user\'s own in one list', async () => {
        respondWith(200, { data: [{ id: 'e1', name: 'Bench press' }] });

        const exercises = await api.exercises();

        assert.equal(fetchCalls[0].url, 'http://127.0.0.1:8000/api/v1/exercises');
        assert.equal(exercises[0].name, 'Bench press');
    });

    test('an empty library is an empty list, not undefined', async () => {
        respondWith(200, { data: null });

        assert.deepEqual(await api.exercises(), []);
    });

    test('history is null when the exercise has never been trained', async () => {
        // Null and "no progress" are different things to put in front of
        // somebody, so this must not collapse into an empty object.
        respondWith(200, { data: null });

        assert.equal(await api.exerciseHistory('e1'), null);
        assert.equal(
            fetchCalls[0].url,
            'http://127.0.0.1:8000/api/v1/exercises/e1/history',
        );
    });
});

describe('workout sessions', () => {
    test('current is null when nothing is running', async () => {
        respondWith(200, { data: null });

        assert.equal(await api.currentWorkoutSession(), null);
        assert.equal(
            fetchCalls[0].url,
            'http://127.0.0.1:8000/api/v1/workout-sessions/current',
        );
    });

    test('starting with a routine sends its id', async () => {
        respondWith(201, { data: { id: 's1' } });

        await api.startWorkoutSession('routine-1');

        assert.equal(fetchCalls[0].init.method, 'POST');
        assert.deepEqual(JSON.parse(fetchCalls[0].init.body), {
            workout_routine_id: 'routine-1',
        });
    });

    test('a freestyle start sends no routine at all', async () => {
        respondWith(201, { data: { id: 's1' } });

        await api.startWorkoutSession(null);

        // Not `workout_routine_id: null` - an absent key and an explicit null
        // are the same to the server here, but sending nothing is the clearer
        // statement and matches what the other clients do.
        assert.deepEqual(JSON.parse(fetchCalls[0].init.body), {});
    });

    test('finishing posts to the session\'s own finish action', async () => {
        respondWith(200, { data: { id: 's1', is_open: false } });

        await api.finishWorkoutSession('s1');

        assert.equal(
            fetchCalls[0].url,
            'http://127.0.0.1:8000/api/v1/workout-sessions/s1/finish',
        );
        assert.equal(fetchCalls[0].init.method, 'POST');
    });
});

describe('logging a set', () => {
    test('it posts the set under its session', async () => {
        respondWith(201, { data: { id: 'set-1' }, is_record: false });

        await api.logWorkoutSet('s1', {
            exercise_id: 'e1',
            reps: 5,
            weight_grams: 60000,
        });

        assert.equal(
            fetchCalls[0].url,
            'http://127.0.0.1:8000/api/v1/workout-sessions/s1/sets',
        );
        assert.deepEqual(JSON.parse(fetchCalls[0].init.body), {
            exercise_id: 'e1',
            reps: 5,
            weight_grams: 60000,
        });
    });

    test('it returns the whole reply so is_record survives', async () => {
        // Unwrapping to `data` would throw away the server's verdict on
        // whether the set was a personal best, which is the point of logging
        // one - the popup celebrates it without a second request.
        respondWith(201, { data: { id: 'set-1' }, is_record: true });

        const reply = await api.logWorkoutSet('s1', { exercise_id: 'e1', reps: 5 });

        assert.equal(reply.is_record, true);
        assert.equal(reply.data.id, 'set-1');
    });

    test('removing a set addresses it directly', async () => {
        respondWith(204, null);

        await api.deleteWorkoutSet('set-1');

        assert.equal(fetchCalls[0].url, 'http://127.0.0.1:8000/api/v1/workout-sets/set-1');
        assert.equal(fetchCalls[0].init.method, 'DELETE');
    });
});

describe('routines', () => {
    test('they are read as a list', async () => {
        respondWith(200, { data: [{ id: 'r1', name: 'Push day', items: [] }] });

        const routines = await api.workoutRoutines();

        assert.equal(fetchCalls[0].url, 'http://127.0.0.1:8000/api/v1/workout-routines');
        assert.equal(routines[0].name, 'Push day');
    });
});

describe('authentication', () => {
    test('every fitness call carries the bearer token', async () => {
        respondWith(200, { data: [] });

        await api.exercises();

        assert.equal(fetchCalls[0].init.headers.Authorization, 'Bearer test-token');
    });
});
