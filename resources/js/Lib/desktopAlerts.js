import { useCallback, useEffect, useState } from 'react';

/**
 * Desktop notifications raised by the page itself.
 *
 * The server deliberately pushes nothing (docs/PRD.md): it only reports
 * whether a workout is due, and each client decides for itself whether to
 * raise a notification. Android does that with WorkManager and the add-on
 * with alarms; this is the web's half of the same design, which is why it
 * needs no service worker or push subscription.
 *
 * The trade-off is that a page can only notify while one of its tabs is
 * open. That is a real limit, not an oversight - delivering to a closed
 * browser would need Web Push, and that is a server that sends, which the
 * PRD rules out.
 */

const STORAGE_KEY = 'jackandthings:desktop-alerts';

export const ALERT_TAGS = {
    workoutDue: 'jack-workout-due',
    // Tagged separately from workoutDue so an "hourly nudge" notification and
    // a "rest is over" one never replace each other - they say different
    // things and arrive for different reasons.
    workoutRestOver: 'jack-workout-rest',
    pomodoro: 'jack-pomodoro-phase',
};

export function alertsSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
}

/** 'granted' | 'denied' | 'default' | 'unsupported' */
export function alertPermission() {
    return alertsSupported() ? window.Notification.permission : 'unsupported';
}

function readPreference() {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'on';
    } catch {
        // Private browsing or blocked storage: alerts simply stay off rather
        // than the page failing to render.
        return false;
    }
}

function writePreference(on) {
    try {
        window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
        // Nothing to do; the toggle just won't survive a reload.
    }
}

/** Both halves must hold: the browser allowed it and the user left it on. */
export function alertsEnabled() {
    return alertPermission() === 'granted' && readPreference();
}

/**
 * Shows a notification, or does nothing at all. Every caller is a background
 * nicety, so a browser that refuses must never break the page around it.
 */
export function notify(title, { body, tag } = {}) {
    if (!alertsEnabled()) {
        return false;
    }

    try {
        // `renotify` is deliberately off: a repeated hourly nudge should
        // replace the previous one quietly rather than buzz again.
        new window.Notification(title, { body, tag });
        return true;
    } catch {
        return false;
    }
}

/**
 * The bell control's state. `blocked` means the browser itself refused, which
 * only the user can undo in site settings - the toggle cannot.
 */
export function useDesktopAlerts() {
    const [permission, setPermission] = useState('unsupported');
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        setPermission(alertPermission());
        setEnabled(alertsEnabled());
    }, []);

    const toggle = useCallback(async () => {
        if (!alertsSupported()) {
            return;
        }

        if (enabled) {
            writePreference(false);
            setEnabled(false);
            return;
        }

        // Only reached from a click, which is what browsers require before
        // they will show the permission prompt.
        let granted = window.Notification.permission;
        if (granted === 'default') {
            granted = await window.Notification.requestPermission();
        }

        setPermission(granted);

        if (granted !== 'granted') {
            return;
        }

        writePreference(true);
        setEnabled(true);
        notify('Alerts are on', {
            body: 'Workout nudges and Pomodoro phase changes will appear here.',
            tag: 'jack-alerts-enabled',
        });
    }, [enabled]);

    return {
        supported: alertsSupported(),
        blocked: permission === 'denied',
        enabled,
        toggle,
    };
}
