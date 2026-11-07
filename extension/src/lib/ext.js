/**
 * The WebExtension namespace, and small promise-friendly wrappers.
 *
 * Firefox exposes `browser` with promises; Chrome exposes `chrome`, which also
 * returns promises for MV3 APIs. Picking one here keeps every caller from
 * having to care which browser it is running in.
 */
export const ext = globalThis.browser ?? globalThis.chrome;

const DEFAULTS = {
    baseUrl: 'http://127.0.0.1:8000/api/v1/',
    token: null,
    user: null,
    remindersEnabled: true,
    historyRecording: false,
    historyAutoDelete: false,
    retentionDays: 90,
    pomodoro: null,
};

export async function readSettings() {
    const stored = await ext.storage.local.get(Object.keys(DEFAULTS));
    return { ...DEFAULTS, ...stored };
}

export async function writeSettings(patch) {
    await ext.storage.local.set(patch);
    return readSettings();
}

export async function clearSession() {
    await ext.storage.local.remove(['token', 'user']);
}

/**
 * True when the user has granted the permission. Everything history-related is
 * optional, so each entry point has to check rather than assume.
 */
export async function hasPermission(permissions) {
    try {
        return await ext.permissions.contains({ permissions });
    } catch {
        return false;
    }
}

export function requestPermission(permissions) {
    return ext.permissions.request({ permissions });
}

/**
 * The API host has to be in host_permissions before a cross-origin fetch is
 * allowed, and the host is whatever the user configured, so it is requested at
 * runtime rather than baked into the manifest.
 */
export async function ensureHostAccess(baseUrl) {
    const origin = originPatternFor(baseUrl);
    if (!origin) return false;

    if (await ext.permissions.contains({ origins: [origin] })) return true;
    return ext.permissions.request({ origins: [origin] });
}

export function originPatternFor(baseUrl) {
    try {
        const url = new URL(baseUrl);
        return `${url.protocol}//${url.host}/*`;
    } catch {
        return null;
    }
}
