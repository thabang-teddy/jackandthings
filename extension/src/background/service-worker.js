import { ext, readSettings, writeSettings, hasPermission } from '../lib/ext.js';
import { api } from '../lib/api.js';
import { startBlocking, stopBlocking } from '../lib/blocking.js';
import { PHASE_FOCUS, minutesFor, nextPhase } from '../lib/pomodoroCycle.js';
import { logSession, rolloverMessage } from '../lib/pomodoroSession.js';

/**
 * Background work for the extension.
 *
 * Four jobs, all alarm-driven so they survive the popup being closed and the
 * service worker being torn down: the hourly workout nudge, the browsing-
 * history clean-up, the end of a Pomodoro phase, and the end of a rest
 * between sets.
 *
 * The rest timer in particular has to live here rather than in the popup. A
 * popup is closed for almost all of a rest - that is what resting is - and a
 * countdown that only runs while its window is open would never once reach
 * zero in normal use.
 */

const ALARM_WORKOUT = 'workout-reminder';
const ALARM_HISTORY = 'history-prune';
const ALARM_POMODORO = 'pomodoro-phase-end';
const ALARM_REST = 'workout-rest-end';

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
 *
 * Since issue #3 this also carries the cycle: which break is due, whether the
 * next phase starts on its own, logging the interval that just ended, and
 * lifting the strict-mode blocklist when focus is over. The rules themselves
 * live in lib/pomodoroCycle.js, shared with the popup and mirrored on the
 * other two surfaces.
 */
async function runPomodoroPhaseEnd() {
    const { pomodoro } = await readSettings();
    if (!pomodoro) return;

    const endedAt = Date.now();
    await logSession(pomodoro, { completed: true, endedAt });

    const next = nextPhase(pomodoro);

    // No break of either length configured: the session ends after focus.
    if (next === null) {
        await stopBlocking();
        await writeSettings({ pomodoro: null });
        await notify('pomodoro', 'Session complete', `${pomodoro.name} has finished.`);
        return;
    }

    const minutes = minutesFor(pomodoro, next.phase);
    const updated = {
        ...pomodoro,
        phase: next.phase,
        completedFocusCycles: next.completedFocusCycles,
        startedAt: next.autoStart ? endedAt : null,
        endsAt: next.autoStart ? endedAt + minutes * 60_000 : null,
        pausedRemaining: next.autoStart ? null : minutes * 60,
    };

    await writeSettings({ pomodoro: updated });
    await applyBlocking(updated);

    if (next.autoStart) {
        await ext.alarms.create(ALARM_POMODORO, { when: updated.endsAt });
    } else {
        await ext.alarms.clear(ALARM_POMODORO);
    }

    const { title, message } = rolloverMessage(pomodoro.phase, next.phase, next.autoStart);
    await notify('pomodoro', title, message);
}

/**
 * Strict mode's blocklist follows the focus phase, and only it - blocking
 * your browsing through a break is the opposite of resting. Driven from here
 * rather than the popup because the popup is shut for most of a session.
 */
async function applyBlocking(session) {
    const blocking =
        session?.strictMode &&
        session.phase === PHASE_FOCUS &&
        session.pausedRemaining == null;

    if (blocking) {
        await startBlocking(session.blockedSites ?? []);
        return;
    }

    await stopBlocking();
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
        case ALARM_REST:
            runRestEnd();
            break;
        default:
            break;
    }
});

/**
 * A rest ran out. Nothing is written anywhere - a rest is not a record of
 * anything - so this only notifies and clears the stored deadline the popup
 * reads to draw its clock.
 */
async function runRestEnd() {
    const { workoutRest } = await readSettings();

    await writeSettings({ workoutRest: null });

    await notify(
        'workout-rest',
        'Rest over',
        workoutRest?.label ? `Next: ${workoutRest.label}` : 'Back to it.',
    );
}

/** The popup asks for these so it does not have to duplicate the logic. */
ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'prune-history-now') {
        runHistoryPrune().then(() => sendResponse({ ok: true }));
        return true;
    }
    if (message?.type === 'schedule-pomodoro') {
        ext.alarms.create(ALARM_POMODORO, { when: message.endsAt });
        // The popup changed the session, so the blocklist may need to change
        // with it - starting a strict preset, or pausing one mid-focus.
        readSettings()
            .then(({ pomodoro }) => applyBlocking(pomodoro))
            .then(() => sendResponse({ ok: true }));
        return true;
    }
    if (message?.type === 'cancel-pomodoro') {
        Promise.all([ext.alarms.clear(ALARM_POMODORO), stopBlocking()]).then(() =>
            sendResponse({ ok: true }),
        );
        return true;
    }
    if (message?.type === 'start-rest') {
        // The deadline is stored as well as scheduled: the alarm fires the
        // notification, and the stored value is what lets the popup draw a
        // live clock when it is reopened mid-rest.
        const endsAt = Date.now() + message.seconds * 1000;

        Promise.all([
            ext.alarms.create(ALARM_REST, { when: endsAt }),
            writeSettings({ workoutRest: { endsAt, label: message.label ?? null } }),
        ]).then(() => sendResponse({ ok: true, endsAt }));
        return true;
    }
    if (message?.type === 'cancel-rest') {
        Promise.all([
            ext.alarms.clear(ALARM_REST),
            writeSettings({ workoutRest: null }),
        ]).then(() => sendResponse({ ok: true }));
        return true;
    }
    return false;
});

/**
 * A service worker that was torn down mid-session wakes with no memory of the
 * rules it installed. Reconciling on startup means a browser restart cannot
 * leave someone's browsing blocked by a timer that is no longer running.
 */
async function reconcilePomodoro() {
    const { pomodoro } = await readSettings();
    await applyBlocking(pomodoro);
}

ext.runtime.onStartup.addListener(reconcilePomodoro);
ext.runtime.onInstalled.addListener(reconcilePomodoro);
