import { readSettings, clearSession } from './ext.js';

/** A non-2xx reply, carrying the status so callers can explain it. */
export class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

function joinUrl(baseUrl, path) {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return base + String(path).replace(/^\//, '');
}

/**
 * Laravel sends `{"message": ...}`, and for a 422 an `errors` map as well. The
 * first field error says more than the generic "data was invalid", so it wins.
 */
function readError(payload, status) {
    if (payload && typeof payload === 'object') {
        const errors = payload.errors;
        if (errors && typeof errors === 'object') {
            for (const value of Object.values(errors)) {
                if (Array.isArray(value) && value.length > 0) return value[0];
            }
        }
        if (typeof payload.message === 'string' && payload.message.trim()) {
            return payload.message;
        }
    }
    return `Request failed with HTTP ${status}`;
}

async function request(path, { method = 'GET', body = null } = {}) {
    const { baseUrl, token } = await readSettings();

    const headers = { Accept: 'application/json' };
    if (body !== null) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
        response = await fetch(joinUrl(baseUrl, path), {
            method,
            headers,
            body: body === null ? undefined : JSON.stringify(body),
        });
    } catch (cause) {
        // A refused connection and a wrong address look the same here, and
        // both are far more likely than a server fault during local work.
        throw new ApiError(0, `Could not reach ${baseUrl} — is the server running?`);
    }

    if (response.status === 204) return null;

    const text = await response.text();
    let payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = null;
        }
    }

    if (!response.ok) {
        // The token is gone or revoked: drop it so the UI falls back to
        // sign-in instead of repeating a request that cannot succeed.
        if (response.status === 401) await clearSession();
        throw new ApiError(response.status, readError(payload, response.status));
    }

    return payload;
}

const data = (payload) => (payload && 'data' in payload ? payload.data : payload);

export const api = {
    // Auth
    async signIn(email, password, deviceName) {
        const payload = await request('auth/token', {
            method: 'POST',
            body: { email, password, device_name: deviceName },
        });
        return data(payload);
    },
    signOut: () => request('auth/token', { method: 'DELETE' }),

    // Notes
    notes: async () => data(await request('notes')) ?? [],
    createNote: async (title, body) =>
        data(await request('notes', { method: 'POST', body: { title, body: body ?? '' } })),
    updateNote: async (id, title, body) =>
        data(await request(`notes/${id}`, { method: 'PUT', body: { title, body: body ?? '' } })),
    // The server validates only the fields present, so the star travels on
    // its own rather than round-tripping the whole note.
    starNote: async (id, isStarred) =>
        data(await request(`notes/${id}`, { method: 'PUT', body: { is_starred: isStarred } })),
    deleteNote: (id) => request(`notes/${id}`, { method: 'DELETE' }),

    // Pomodoro
    presets: async () => data(await request('pomodoro-presets')) ?? [],
    /**
     * `body` is the preset payload in wire spelling, built by the caller.
     * Fourteen named arguments would be worse than one object, and the server
     * defaults everything but `name` and `focus_minutes`, so a partial body
     * is valid - see PomodoroPresetRequest.
     */
    createPreset: async (body) =>
        data(await request('pomodoro-presets', { method: 'POST', body })),
    updatePreset: async (id, body) =>
        data(await request(`pomodoro-presets/${id}`, { method: 'PUT', body })),
    deletePreset: (id) => request(`pomodoro-presets/${id}`, { method: 'DELETE' }),

    // Pomodoro sessions — finished intervals, and the analytics read off them.
    pomodoroSessions: async (limit = 30) =>
        data(await request(`pomodoro-sessions?limit=${limit}`)) ?? [],
    createPomodoroSession: async (body) =>
        data(await request('pomodoro-sessions', { method: 'POST', body })),
    deletePomodoroSession: (id) => request(`pomodoro-sessions/${id}`, { method: 'DELETE' }),
    /** `tz` is an IANA zone; the server buckets in it rather than UTC. */
    pomodoroStats: async (tz) =>
        data(await request(`pomodoro-sessions/stats?tz=${encodeURIComponent(tz)}`)),

    // Watch list — named lists, each holding items.
    watchLists: async () => data(await request('watch-lists')) ?? [],
    createWatchList: async (name) =>
        data(await request('watch-lists', { method: 'POST', body: { name } })),
    deleteWatchList: (id) => request(`watch-lists/${id}`, { method: 'DELETE' }),
    createWatchListItem: async (watchListId, title, note) =>
        data(
            await request('watch-list-items', {
                method: 'POST',
                body: {
                    watch_list_id: watchListId,
                    title,
                    note: note ?? '',
                },
            }),
        ),
    updateWatchListItem: (id, fields) =>
        data(
            request(`watch-list-items/${id}`, {
                method: 'PUT',
                body: fields,
            }),
        ),
    deleteWatchListItem: (id) => request(`watch-list-items/${id}`, { method: 'DELETE' }),

    // Workout
    workoutEntries: async () => data(await request('workout-entries')) ?? [],
    reminderState: async () => data(await request('workout-entries/due')),
    createWorkoutEntry: async (activity, notes, loggedAt) =>
        data(
            await request('workout-entries', {
                method: 'POST',
                body: {
                    activity,
                    notes: notes ?? '',
                    ...(loggedAt ? { logged_at: loggedAt } : {}),
                },
            }),
        ),
    deleteWorkoutEntry: (id) => request(`workout-entries/${id}`, { method: 'DELETE' }),

    workoutPresets: async () => data(await request('workout-presets')) ?? [],
    createWorkoutPreset: async (name, activity) =>
        data(
            await request('workout-presets', {
                method: 'POST',
                body: { name, activity },
            }),
        ),
    deleteWorkoutPreset: (id) => request(`workout-presets/${id}`, { method: 'DELETE' }),

    // Fitness tracking (issue #4)
    //
    // The library is the server's seeded catalog plus the user's own, in one
    // list. The add-on reads it and logs against it; building routines and
    // keeping body metrics stay on the web app and the phone, where there is
    // room for them - a popup is not where you plan a training block.
    exercises: async () => data(await request('exercises')) ?? [],

    /** Null when the exercise has never been trained, not an empty history. */
    exerciseHistory: async (id) => data(await request(`exercises/${id}/history`)) ?? null,

    workoutRoutines: async () => data(await request('workout-routines')) ?? [],

    /** Null when nothing is running, which is the normal case. */
    currentWorkoutSession: async () => data(await request('workout-sessions/current')) ?? null,

    startWorkoutSession: async (routineId) =>
        data(
            await request('workout-sessions', {
                method: 'POST',
                body: routineId ? { workout_routine_id: routineId } : {},
            }),
        ),

    finishWorkoutSession: async (id) =>
        data(await request(`workout-sessions/${id}/finish`, { method: 'POST' })),

    /**
     * Seven named arguments would be worse than one object, so the set rides
     * in whole - the same call createWorkoutPreset's neighbours make.
     *
     * The whole reply is returned rather than its `data`, because `is_record`
     * sits beside the row and is the point of logging a set: the popup
     * celebrates a personal best without a second request.
     */
    logWorkoutSet: async (sessionId, set) =>
        request(`workout-sessions/${sessionId}/sets`, { method: 'POST', body: set }),

    deleteWorkoutSet: (id) => request(`workout-sets/${id}`, { method: 'DELETE' }),

    // Budget
    budgetAccounts: async () => data(await request('budget-accounts')) ?? [],
    createBudgetAccount: async (name) =>
        data(await request('budget-accounts', { method: 'POST', body: { name } })),
    budgetTransactions: async () => data(await request('budget-transactions')) ?? [],
    /**
     * [extras] carries issue #5's three optional columns: `occurredOn`
     * (`YYYY-MM-DD`, the business date), `merchant` and `categoryId`. They are
     * omitted rather than sent empty, because the server treats an absent
     * `occurred_on` as today and an absent category as uncategorised.
     */
    createTransaction: async (accountId, type, amount, description, extras = {}) =>
        data(
            await request('budget-transactions', {
                method: 'POST',
                body: {
                    account_id: accountId,
                    type,
                    amount,
                    description: description ?? '',
                    ...(extras.occurredOn ? { occurred_on: extras.occurredOn } : {}),
                    ...(extras.merchant ? { merchant: extras.merchant } : {}),
                    ...(extras.categoryId ? { category_id: extras.categoryId } : {}),
                },
            }),
        ),
    /** Seeded by the server on first read, so this is never empty on success. */
    budgetCategories: async () => data(await request('budget-categories')) ?? [],
    /** Caps for one `YYYY-MM`, with the month's spend already totalled. */
    budgetLimits: async (period) =>
        data(await request(`budget-limits?period=${encodeURIComponent(period)}`)) ?? [],
    transfer: (fromAccountId, toAccountId, amount, description) =>
        request('budget-transfers', {
            method: 'POST',
            body: {
                from_account_id: fromAccountId,
                to_account_id: toAccountId,
                amount,
                description: description ?? '',
            },
        }),

    // Recurring budget transactions
    recurringTransactions: async () =>
        data(await request('recurring-transactions')) ?? [],
    createRecurring: async (accountId, type, amount, cadence, nextRunAt, description) =>
        data(
            await request('recurring-transactions', {
                method: 'POST',
                body: {
                    account_id: accountId,
                    type,
                    amount,
                    cadence,
                    next_run_at: nextRunAt,
                    description: description ?? '',
                },
            }),
        ),
    deleteRecurring: (id) => request(`recurring-transactions/${id}`, { method: 'DELETE' }),

    // History
    /** Returns both the rows and the server's retention window. */
    async historyEntries() {
        const payload = await request('history-entries');
        return {
            entries: payload?.data ?? [],
            retentionDays: payload?.meta?.retention_days ?? null,
        };
    },
    createHistoryEntry: async (url, title, visitedAt) =>
        data(
            await request('history-entries', {
                method: 'POST',
                body: { url, title: title ?? '', visited_at: visitedAt },
            }),
        ),
    deleteHistoryEntry: (id) => request(`history-entries/${id}`, { method: 'DELETE' }),
};
