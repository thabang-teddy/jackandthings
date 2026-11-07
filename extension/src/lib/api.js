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
    deleteNote: (id) => request(`notes/${id}`, { method: 'DELETE' }),

    // Pomodoro
    presets: async () => data(await request('pomodoro-presets')) ?? [],
    createPreset: async (name, focusMinutes, breakMinutes) =>
        data(
            await request('pomodoro-presets', {
                method: 'POST',
                body: { name, focus_minutes: focusMinutes, break_minutes: breakMinutes },
            }),
        ),
    deletePreset: (id) => request(`pomodoro-presets/${id}`, { method: 'DELETE' }),

    // Clipboard
    clipboardItems: async () => data(await request('clipboard-items')) ?? [],
    createClipboardItem: async (title, content, sourceDevice) =>
        data(
            await request('clipboard-items', {
                method: 'POST',
                body: { title: title ?? '', content, source_device: sourceDevice },
            }),
        ),
    deleteClipboardItem: (id) => request(`clipboard-items/${id}`, { method: 'DELETE' }),

    // Workout
    workoutEntries: async () => data(await request('workout-entries')) ?? [],
    reminderState: async () => data(await request('workout-entries/due')),
    createWorkoutEntry: async (activity, notes) =>
        data(
            await request('workout-entries', {
                method: 'POST',
                body: { activity, notes: notes ?? '' },
            }),
        ),
    deleteWorkoutEntry: (id) => request(`workout-entries/${id}`, { method: 'DELETE' }),

    // Budget
    budgetAccounts: async () => data(await request('budget-accounts')) ?? [],
    createBudgetAccount: async (name) =>
        data(await request('budget-accounts', { method: 'POST', body: { name } })),
    budgetTransactions: async () => data(await request('budget-transactions')) ?? [],
    createTransaction: async (accountId, type, amount, description) =>
        data(
            await request('budget-transactions', {
                method: 'POST',
                body: {
                    account_id: accountId,
                    type,
                    amount,
                    description: description ?? '',
                },
            }),
        ),
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
