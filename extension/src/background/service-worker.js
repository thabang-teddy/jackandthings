import { ext, readSettings, writeSettings, hasPermission } from '../lib/ext.js';
import { api } from '../lib/api.js';

/**
 * Background work for the extension.
 *
 * Three jobs, all alarm-driven so they survive the popup being closed and the
 * service worker being torn down: the hourly workout nudge, the browsing-
 * history clean-up, and the end of a Pomodoro phase.
 */

const ALARM_WORKOUT = 'workout-reminder';
const ALARM_HISTORY = 'history-prune';
const ALARM_POMODORO = 'pomodoro-phase-end';

const HOUR_IN_MINUTES = 60;
const DAY_IN_MINUTES = 60 * 24;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function iconUrl() {
    return ext.runtime.getURL('icons/icon-128.png');
}

async function notify(id, title, message) {
    try {
        await ext.notifications.create(id, {
            type: 'basic',
            iconUrl: iconUrl(),
            title,
            message,
        });
    } catch (error) {
        console.warn('[jack] could not post a notification', error);
    }
}

async function ensureAlarms() {
    await ext.alarms.create(ALARM_WORKOUT, { periodInMinutes: HOUR_IN_MINUTES });
    await ext.alarms.create(ALARM_HISTORY, { periodInMinutes: DAY_IN_MINUTES });
}

ext.runtime.onInstalled.addListener(ensureAlarms);
ext.runtime.onStartup.addListener(ensureAlarms);

// ── Workout reminder ───────────────────────────────────────────────────────

/**
 * The server reports whether anything was logged this hour and sends nothing
 * itself; raising the notification is this client's decision, the same
 * arrangement the Android app uses.
 */
async function runWorkoutReminder() {
    const { token, remindersEnabled } = await readSettings();
    if (!token || !remindersEnabled) return;

    try {
        const state = await api.reminderState();
        if (state?.due) {
            await notify(
                'workout-due',
                'No workout logged this hour',
                'Open Jack & Things to log what you have done.',
            );
        }
    } catch (error) {
        // A failed check is not worth bothering the user about; the next hour
        // will try again.
        console.warn('[jack] workout reminder check failed', error);
    }
}

// ── History clean-up ───────────────────────────────────────────────────────

/**
 * Deletes browsing history older than the retention window.
 *
 * Destructive and therefore strictly opt-in: it needs both the optional
 * `history` permission and the historyAutoDelete setting. The window comes
 * from the server so the rule lives in one place — but note the server's own
 * default is a placeholder, not an approved policy (see docs/PRD.md).
 */
async function runHistoryPrune() {
    const settings = await readSettings();
    if (!settings.token || !settings.historyAutoDelete) return;
    if (!(await hasPermission(['history']))) return;

    let retentionDays = settings.retentionDays;
    try {
        const { retentionDays: serverValue } = await api.historyEntries();
        if (Number.isFinite(serverValue) && serverValue > 0) {
            retentionDays = serverValue;
            await writeSettings({ retentionDays: serverValue });
        }
    } catch (error) {
        // Fall back to the last known window rather than skipping the prune.
        console.warn('[jack] could not read the retention window', error);
    }

    if (!Number.isFinite(retentionDays) || retentionDays < 1) return;

    const endTime = Date.now() - retentionDays * MS_PER_DAY;
    try {
        await ext.history.deleteRange({ startTime: 0, endTime });
        console.info(`[jack] pruned browser history older than ${retentionDays} days`);
    } catch (error) {
        console.warn('[jack] history prune failed', error);
    }
}

/**
 * Mirrors visits to the server so history is manageable from there, which is
 * what "manage the url on the Laravel server" asks for. Only http(s) pages:
 * extension and browser-internal URLs are noise.
 */
async function recordVisit(item) {
    const settings = await readSettings();
    if (!settings.token || !settings.historyRecording) return;
    if (!item?.url) return;
    if (!/^https?:/i.test(item.url)) return;

    try {
        await api.createHistoryEntry(
            item.url,
            item.title ?? '',
            new Date(item.lastVisitTime ?? Date.now()).toISOString(),
        );
    } catch (error) {
        console.warn('[jack] could not record a visit', error);
    }
}

// Registered unconditionally: the listener itself is harmless without the
// optional permission, and attaching it later is not possible once the service
// worker has been torn down and revived.
if (ext.history?.onVisited) {
    ext.history.onVisited.addListener(recordVisit);
}

// ── Pomodoro ───────────────────────────────────────────────────────────────

/**
 * The timer is a stored end-time rather than a running interval, so closing
 * the popup does not stop it and the service worker can sleep in between.
 */
async function runPomodoroPhaseEnd() {
    const { pomodoro } = await readSettings();
    if (!pomodoro) return;

    if (pomodoro.phase === 'focus' && pomodoro.breakMinutes > 0) {
        const endsAt = Date.now() + pomodoro.breakMinutes * 60_000;
        await writeSettings({ pomodoro: { ...pomodoro, phase: 'break', endsAt } });
        await ext.alarms.create(ALARM_POMODORO, { when: endsAt });
        await notify('pomodoro', 'Focus done', `Break for ${pomodoro.breakMinutes} minutes.`);
        return;
    }

    await writeSettings({ pomodoro: null });
    await notify('pomodoro', 'Session complete', `${pomodoro.name} has finished.`);
}

ext.alarms.onAlarm.addListener((alarm) => {
    switch (alarm.name) {
        case ALARM_WORKOUT:
            runWorkoutReminder();
            break;
        case ALARM_HISTORY:
            runHistoryPrune();
            break;
        case ALARM_POMODORO:
            runPomodoroPhaseEnd();
            break;
        default:
            break;
    }
});

/** The popup asks for these so it does not have to duplicate the logic. */
ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'prune-history-now') {
        runHistoryPrune().then(() => sendResponse({ ok: true }));
        return true;
    }
    if (message?.type === 'schedule-pomodoro') {
        ext.alarms.create(ALARM_POMODORO, { when: message.endsAt });
        sendResponse({ ok: true });
        return true;
    }
    if (message?.type === 'cancel-pomodoro') {
        ext.alarms.clear(ALARM_POMODORO).then(() => sendResponse({ ok: true }));
        return true;
    }
    return false;
});
