/**
 * Strict mode on the web, and an honest account of its limits.
 *
 * Issue #3 asks for a mode that "locks the screen or blocks distracting
 * notifications while a focus timer is running". A web page cannot do either:
 * it cannot suppress another application's notifications, it cannot take over
 * the OS, and it cannot stop the user closing the tab. Claiming otherwise in
 * the UI would be the worst outcome - somebody would trust it.
 *
 * What a page *can* do, and what this module does:
 *
 *   - hold a screen wake lock, so the display does not sleep mid-interval;
 *   - go fullscreen, which hides the rest of the browser including its tabs;
 *   - warn before the tab is closed or reloaded, via beforeunload;
 *   - tell the caller when focus left the page, which is what the UI uses to
 *     say "you left" rather than pretending it could have prevented it.
 *
 * The add-on is the surface that can actually block things - it has
 * declarativeNetRequest and a host blocklist - and Android can ask for
 * Do Not Disturb. Both are wired to the same `strict_mode` preset flag.
 */

const WARNING = 'A focus session is running in strict mode.';

let release = null;

function wakeLockSupported() {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

function guardUnload(event) {
    event.preventDefault();
    // Browsers ignore the message and show their own, but returnValue is
    // still what triggers the prompt in several of them.
    event.returnValue = WARNING;

    return WARNING;
}

/**
 * Turns strict mode on and returns its teardown function.
 *
 * Synchronous on purpose, even though the wake lock is not: a React effect
 * needs its cleanup available the moment it runs, and awaiting the lock first
 * would leave a window where unmounting could not undo what engaging had
 * already done. So the listeners go on immediately and the lock is chased in
 * the background, with `released` telling a late-arriving sentinel that
 * nobody wants it any more.
 *
 * Safe to call twice: the second call tears the first down first, so the page
 * can react to a preset change without leaking a lock.
 */
export function engageStrictMode({ onLeave } = {}) {
    disengageStrictMode();

    const blur = () => onLeave?.();
    let sentinel = null;
    let released = false;

    window.addEventListener('beforeunload', guardUnload);
    if (onLeave) {
        window.addEventListener('blur', blur);
    }

    if (wakeLockSupported()) {
        navigator.wakeLock
            .request('screen')
            .then((lock) => {
                sentinel = lock;
                if (released) {
                    lock.release().catch(() => {});
                }
            })
            // Denied, or the document is hidden. Strict mode still does the rest.
            .catch(() => {});
    }

    release = () => {
        released = true;
        window.removeEventListener('beforeunload', guardUnload);
        window.removeEventListener('blur', blur);

        try {
            sentinel?.release();
        } catch {
            // Already released by the browser when the tab was hidden.
        }
    };

    return release;
}

export function disengageStrictMode() {
    if (!release) {
        return;
    }

    release();
    release = null;
}

export function strictModeActive() {
    return release !== null;
}

/**
 * What strict mode is actually doing right now, for the UI to state plainly
 * instead of implying it blocked something it cannot.
 */
export function strictModeCapabilities() {
    return {
        keepsScreenAwake: wakeLockSupported(),
        warnsBeforeLeaving: true,
        canBlockSites: false,
        canBlockNotifications: false,
    };
}
