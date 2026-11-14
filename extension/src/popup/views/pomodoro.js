import { api } from '../../lib/api.js';
import { ext, readSettings, writeSettings } from '../../lib/ext.js';
import { h, clear, muted, guard } from '../../lib/dom.js';
import { formatClock } from '../../lib/format.js';
import {
    PHASE_FOCUS,
    cyclePosition,
    minutesFor,
    nextPhase,
    phaseLabel,
    secondsFor,
    sessionFromPreset,
} from '../../lib/pomodoroCycle.js';
import { logSession, currentTimezone } from '../../lib/pomodoroSession.js';
import { playAlarm, startAmbience, stopAmbience } from '../../lib/sounds.js';
import {
    blockingSupported,
    hasBlockingPermission,
    requestBlockingPermission,
    startBlocking,
    stopBlocking,
} from '../../lib/blocking.js';
import { renderPresetForm } from './pomodoroPreset.js';
import { renderAnalytics } from './pomodoroAnalytics.js';

/**
 * A popup is destroyed the moment it loses focus, so the timer cannot be a
 * setInterval living in this page. What is stored is the moment the phase
 * ends; the popup derives the remaining seconds whenever it opens, and a
 * background alarm handles the end even while the popup is shut.
 *
 * The cycle rules themselves are in lib/pomodoroCycle.js, shared with the
 * service worker - the background is what rolls a phase over most of the
 * time, so both halves have to agree exactly.
 */

function remainingSeconds(pomodoro) {
    if (!pomodoro) return 0;
    if (pomodoro.pausedRemaining != null) return pomodoro.pausedRemaining;

    return Math.max(0, Math.round((pomodoro.endsAt - Date.now()) / 1000));
}

async function startPreset(preset) {
    const session = sessionFromPreset(preset);

    await writeSettings({ pomodoro: session });
    await ext.runtime.sendMessage({ type: 'schedule-pomodoro', endsAt: session.endsAt });
}

async function pause(pomodoro) {
    // Pausing ends the interval as far as the log is concerned: resuming
    // starts its clock again, so counting the pause as focus time would be a
    // lie the analytics then repeat back.
    await logSession(pomodoro, { completed: false });
    await writeSettings({
        pomodoro: { ...pomodoro, pausedRemaining: remainingSeconds(pomodoro), startedAt: null },
    });
    await ext.runtime.sendMessage({ type: 'cancel-pomodoro' });
}

async function resume(pomodoro) {
    const now = Date.now();
    const endsAt = now + (pomodoro.pausedRemaining ?? 0) * 1000;

    await writeSettings({
        pomodoro: { ...pomodoro, endsAt, startedAt: now, pausedRemaining: null },
    });
    await ext.runtime.sendMessage({ type: 'schedule-pomodoro', endsAt });
}

async function stop(pomodoro) {
    if (pomodoro) await logSession(pomodoro, { completed: false });

    await writeSettings({ pomodoro: null });
    await ext.runtime.sendMessage({ type: 'cancel-pomodoro' });
    stopAmbience();
}

/**
 * The pure half of `restart`/`skip`: what the stored `pomodoro` object should
 * become, with no side effects, so this part is unit-testable without a
 * browser. `null` from `skipPatch` means "nowhere to go, so stop the session"
 * rather than a phase change.
 */

/** Back to the top of the focus phase, paused, and the set starts again. */
export function restartPatch(pomodoro) {
    return {
        ...pomodoro,
        phase: PHASE_FOCUS,
        completedFocusCycles: 0,
        pausedRemaining: secondsFor(pomodoro, PHASE_FOCUS),
        startedAt: null,
        endsAt: null,
    };
}

/**
 * Jumps straight to the next phase without waiting for the clock, keeping
 * whatever running/paused state it was already in - pressing Skip is already
 * the manual decision the auto-start toggles are about.
 */
export function skipPatch(pomodoro, now = Date.now()) {
    const next = nextPhase(pomodoro);
    if (next === null) return null;

    const running = pomodoro.pausedRemaining == null;
    const minutes = minutesFor(pomodoro, next.phase);

    if (running) {
        return {
            ...pomodoro,
            phase: next.phase,
            completedFocusCycles: next.completedFocusCycles,
            startedAt: now,
            endsAt: now + minutes * 60_000,
            pausedRemaining: null,
        };
    }

    return {
        ...pomodoro,
        phase: next.phase,
        completedFocusCycles: next.completedFocusCycles,
        startedAt: null,
        endsAt: null,
        pausedRemaining: minutes * 60,
    };
}

async function restart(pomodoro) {
    await logSession(pomodoro, { completed: false });
    await writeSettings({ pomodoro: restartPatch(pomodoro) });
    await ext.runtime.sendMessage({ type: 'cancel-pomodoro' });
}

async function skip(pomodoro) {
    // Logged as abandoned, not completed: "I skipped four of six today" is
    // exactly what the analytics should be able to show.
    await logSession(pomodoro, { completed: false });

    const patch = skipPatch(pomodoro);
    if (patch === null) {
        await stop(null);
        return;
    }

    await writeSettings({ pomodoro: patch });

    if (patch.pausedRemaining == null) {
        await ext.runtime.sendMessage({ type: 'schedule-pomodoro', endsAt: patch.endsAt });
    } else {
        await ext.runtime.sendMessage({ type: 'cancel-pomodoro' });
    }
}

/** "3 of 4" as dots, so the long break is never a surprise. */
function cycleDots(pomodoro) {
    const { index, length } = cyclePosition(pomodoro);
    if (length <= 1) return null;

    const dots = Array.from({ length }, (_, slot) =>
        h('span', {
            class: `cycle-dot${slot + 1 === index ? ' current' : ''}${slot + 1 < index ? ' done' : ''}`,
        }),
    );

    return h('div', { class: 'cycle' }, [...dots, h('span', { class: 'muted', text: ` ${index}/${length}` })]);
}

function timerCard(pomodoro, rerender, view) {
    const running = pomodoro.pausedRemaining == null;
    const clock = h('div', { class: 'clock', text: formatClock(remainingSeconds(pomodoro)) });

    const button = (text, action) =>
        h('button', {
            class: 'btn-ghost',
            type: 'button',
            text,
            onClick: () =>
                guard(view, async () => {
                    await action();
                    await rerender();
                }),
        });

    const children = [
        h('div', {
            class: 'muted',
            text: `${phaseLabel(pomodoro.phase)} · ${pomodoro.name}${pomodoro.tag ? ` · ${pomodoro.tag}` : ''}`,
        }),
        clock,
    ];

    const dots = cycleDots(pomodoro);
    if (dots) children.push(dots);

    children.push(
        h('div', { class: 'split' }, [
            button('Restart', () => restart(pomodoro)),
            button(running ? 'Pause' : 'Resume', () =>
                running ? pause(pomodoro) : resume(pomodoro),
            ),
            button('Skip', () => skip(pomodoro)),
            button('Stop', () => stop(pomodoro)),
        ]),
    );

    if (pomodoro.strictMode) {
        children.push(strictNotice(pomodoro, rerender, view));
    }

    return { card: h('div', { class: 'card timer' }, children), clock, running };
}

/**
 * Strict mode is the one thing this surface can really do - and only with a
 * permission the user has to grant. Said plainly either way rather than
 * implying a block that is not happening.
 */
function strictNotice(pomodoro, rerender, view) {
    const sites = pomodoro.blockedSites ?? [];

    if (!blockingSupported() || sites.length === 0) {
        return muted('Strict mode is on, but this preset lists no sites to block.');
    }

    const row = h('div', { class: 'muted' }, [
        h('span', { text: `Strict mode: blocking ${sites.length} site(s) while focusing.` }),
    ]);

    hasBlockingPermission().then((granted) => {
        if (granted) return;

        clear(row).append(
            h('span', { text: 'Strict mode needs permission to block sites. ' }),
            h('button', {
                class: 'btn-link',
                type: 'button',
                text: 'Grant it',
                onClick: () =>
                    guard(view, async () => {
                        if (await requestBlockingPermission()) {
                            await startBlocking(sites);
                            await rerender();
                        }
                    }),
            }),
        );
    });

    return row;
}

function presetCard(preset, pomodoro, rerender, view, onEdit) {
    const details = [`${preset.focus_minutes} min focus`];
    details.push(
        preset.break_minutes > 0 ? `${preset.break_minutes} min break` : 'no break',
    );
    if (preset.long_break_minutes > 0) {
        details.push(
            `${preset.long_break_minutes} min long every ${preset.cycles_before_long_break}`,
        );
    }

    const flags = [
        preset.auto_start_breaks ? 'auto breaks' : 'manual breaks',
        preset.auto_start_focus ? 'auto focus' : 'manual focus',
    ];
    if (preset.ambience && preset.ambience !== 'none') flags.push(preset.ambience);
    if (preset.strict_mode) flags.push('strict');

    return h('div', { class: 'card' }, [
        h('div', { class: 'row' }, [
            h('div', { class: 'grow' }, [
                h('strong', { text: preset.name }),
                preset.tag ? h('span', { class: 'chip', text: preset.tag }) : null,
                h('div', { class: 'muted', text: details.join(' · ') }),
                h('div', { class: 'muted small', text: flags.join(' · ') }),
            ].filter(Boolean)),
            h('button', {
                class: 'btn',
                type: 'button',
                text: 'Start',
                disabled: Boolean(pomodoro),
                onClick: () =>
                    guard(view, async () => {
                        await startPreset(preset);
                        await rerender();
                    }),
            }),
            h('button', {
                class: 'btn-link',
                type: 'button',
                text: 'Edit',
                onClick: () => onEdit(preset),
            }),
            h('button', {
                class: 'btn-link btn-danger',
                type: 'button',
                text: 'Delete',
                onClick: () =>
                    guard(view, async () => {
                        await api.deletePreset(preset.id);
                        await rerender();
                    }),
            }),
        ]),
    ]);
}

export async function renderPomodoro(view, rerender, options = {}) {
    clear(view).append(muted('Loading presets…'));

    const [{ pomodoro }, presets, stats] = await Promise.all([
        readSettings(),
        api.presets(),
        // The analytics are a nicety; a server that cannot report them must
        // not stop the timer rendering.
        api.pomodoroStats(currentTimezone()).catch(() => null),
    ]);

    clear(view);

    if (pomodoro) {
        const { card, clock, running } = timerCard(pomodoro, rerender, view);
        view.append(card);

        // Sound plays only while this popup is open - an MV3 service worker
        // has no AudioContext. See lib/sounds.js.
        if (running && pomodoro.phase === PHASE_FOCUS) {
            startAmbience(pomodoro.ambience ?? 'none');
        } else {
            stopAmbience();
        }

        // Only ticks while the popup is open; the stored end time is the real
        // clock, so this is display only and stops with the page.
        if (running) {
            const handle = setInterval(() => {
                const left = remainingSeconds(pomodoro);
                clock.textContent = formatClock(left);
                if (left <= 0) {
                    clearInterval(handle);
                    playAlarm(pomodoro.alarmSound ?? 'chime');
                    rerender();
                }
            }, 1000);
            window.addEventListener(
                'pagehide',
                () => {
                    clearInterval(handle);
                    stopAmbience();
                },
                { once: true },
            );
        }
    } else {
        stopAmbience();
        stopBlocking();
    }

    if (stats) {
        view.append(renderAnalytics(stats));
    }

    view.append(h('h2', { text: 'Presets' }));

    if (presets.length === 0) {
        view.append(muted('No presets yet — add one below.'));
    }

    const editing = options.editing ?? null;
    const edit = (preset) => rerender({ editing: preset });

    for (const preset of presets) {
        view.append(presetCard(preset, pomodoro, rerender, view, edit));
    }

    view.append(
        renderPresetForm({
            view,
            editing,
            knownTags: [
                ...new Set(presets.map((preset) => preset.tag).filter(Boolean)),
            ],
            onDone: () => rerender({ editing: null }),
        }),
    );
}
