import { api } from '../../lib/api.js';
import { ext, readSettings, writeSettings } from '../../lib/ext.js';
import { h, clear, muted, guard } from '../../lib/dom.js';
import { formatClock } from '../../lib/format.js';

/**
 * A popup is destroyed the moment it loses focus, so the timer cannot be a
 * setInterval living in this page. What is stored is the moment the phase
 * ends; the popup derives the remaining seconds whenever it opens, and a
 * background alarm handles the end even while the popup is shut.
 */

function remainingSeconds(pomodoro) {
    if (!pomodoro) return 0;
    if (pomodoro.pausedRemaining != null) return pomodoro.pausedRemaining;
    return Math.max(0, Math.round((pomodoro.endsAt - Date.now()) / 1000));
}

async function startPreset(preset) {
    const endsAt = Date.now() + preset.focus_minutes * 60_000;
    await writeSettings({
        pomodoro: {
            presetId: preset.id,
            name: preset.name,
            phase: 'focus',
            focusMinutes: preset.focus_minutes,
            breakMinutes: preset.break_minutes,
            endsAt,
            pausedRemaining: null,
        },
    });
    await ext.runtime.sendMessage({ type: 'schedule-pomodoro', endsAt });
}

async function pause(pomodoro) {
    await writeSettings({
        pomodoro: { ...pomodoro, pausedRemaining: remainingSeconds(pomodoro) },
    });
    await ext.runtime.sendMessage({ type: 'cancel-pomodoro' });
}

async function resume(pomodoro) {
    const endsAt = Date.now() + (pomodoro.pausedRemaining ?? 0) * 1000;
    await writeSettings({ pomodoro: { ...pomodoro, endsAt, pausedRemaining: null } });
    await ext.runtime.sendMessage({ type: 'schedule-pomodoro', endsAt });
}

async function stop() {
    await writeSettings({ pomodoro: null });
    await ext.runtime.sendMessage({ type: 'cancel-pomodoro' });
}

/** Back to the top of the focus phase, paused - mirrors Lib/useCountdown.js's `restart`. */
async function restart(pomodoro) {
    await writeSettings({
        pomodoro: {
            ...pomodoro,
            phase: 'focus',
            pausedRemaining: pomodoro.focusMinutes * 60,
        },
    });
    await ext.runtime.sendMessage({ type: 'cancel-pomodoro' });
}

/**
 * Jumps straight to the other phase without waiting for the clock to run
 * out, keeping whatever running/paused state it was already in. Mirrors the
 * natural roll-over when there is no break to skip into.
 */
async function skip(pomodoro) {
    const running = pomodoro.pausedRemaining == null;

    if (pomodoro.phase === 'focus') {
        if (pomodoro.breakMinutes > 0) {
            await toPhase(pomodoro, 'break', pomodoro.breakMinutes, running);
        } else {
            await stop();
        }
        return;
    }

    await toPhase(pomodoro, 'focus', pomodoro.focusMinutes, running);
}

async function toPhase(pomodoro, phase, minutes, running) {
    if (running) {
        const endsAt = Date.now() + minutes * 60_000;
        await writeSettings({ pomodoro: { ...pomodoro, phase, endsAt, pausedRemaining: null } });
        await ext.runtime.sendMessage({ type: 'schedule-pomodoro', endsAt });
    } else {
        await writeSettings({ pomodoro: { ...pomodoro, phase, pausedRemaining: minutes * 60 } });
    }
}

export async function renderPomodoro(view, rerender) {
    clear(view).append(muted('Loading presets…'));

    const [{ pomodoro }, presets] = await Promise.all([readSettings(), api.presets()]);
    clear(view);

    if (pomodoro) {
        const clock = h('div', { class: 'clock', text: formatClock(remainingSeconds(pomodoro)) });
        const running = pomodoro.pausedRemaining == null;

        view.append(
            h('div', { class: 'card timer' }, [
                h('div', {
                    class: 'muted',
                    text: `${pomodoro.phase === 'focus' ? 'Focus' : 'Break'} · ${pomodoro.name}`,
                }),
                clock,
                h('div', { class: 'split' }, [
                    h('button', {
                        class: 'btn-ghost',
                        type: 'button',
                        text: 'Restart',
                        onClick: () =>
                            guard(view, async () => {
                                await restart(pomodoro);
                                await rerender();
                            }),
                    }),
                    h('button', {
                        class: 'btn-ghost',
                        type: 'button',
                        text: running ? 'Pause' : 'Resume',
                        onClick: () =>
                            guard(view, async () => {
                                await (running ? pause(pomodoro) : resume(pomodoro));
                                await rerender();
                            }),
                    }),
                    h('button', {
                        class: 'btn-ghost',
                        type: 'button',
                        text: 'Skip',
                        onClick: () =>
                            guard(view, async () => {
                                await skip(pomodoro);
                                await rerender();
                            }),
                    }),
                    h('button', {
                        class: 'btn-ghost',
                        type: 'button',
                        text: 'Stop',
                        onClick: () =>
                            guard(view, async () => {
                                await stop();
                                await rerender();
                            }),
                    }),
                ]),
            ]),
        );

        // Only ticks while the popup is open; the stored end time is the real
        // clock, so this is display only and stops with the page.
        if (running) {
            const handle = setInterval(() => {
                const left = remainingSeconds(pomodoro);
                clock.textContent = formatClock(left);
                if (left <= 0) clearInterval(handle);
            }, 1000);
            window.addEventListener('pagehide', () => clearInterval(handle), { once: true });
        }
    }

    view.append(h('h2', { text: 'Presets' }));

    if (presets.length === 0) {
        view.append(muted('No presets yet — add one below.'));
    }

    for (const preset of presets) {
        view.append(
            h('div', { class: 'card' }, [
                h('div', { class: 'row' }, [
                    h('div', { class: 'grow' }, [
                        h('strong', { text: preset.name }),
                        h('div', {
                            class: 'muted',
                            text: `${preset.focus_minutes} min focus · ${preset.break_minutes} min break`,
                        }),
                    ]),
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
            ]),
        );
    }

    view.append(
        h('form', {
            class: 'card stack',
            onSubmit: (event) => {
                event.preventDefault();
                const form = event.target;
                const name = form.elements.name.value.trim();
                const focus = Number(form.elements.focus.value);
                const pauseMinutes = Number(form.elements.pause.value);
                if (!name || !Number.isFinite(focus) || focus < 1) return;

                form.elements.save.disabled = true;
                guard(view, async () => {
                    await api.createPreset(name, focus, Number.isFinite(pauseMinutes) ? pauseMinutes : 0);
                    await rerender();
                });
            },
        }, [
            h('label', { text: 'New preset' }, [
                h('input', { name: 'name', required: true, placeholder: 'Deep work' }),
            ]),
            h('div', { class: 'split' }, [
                h('label', { text: 'Focus min' }, [
                    h('input', { name: 'focus', type: 'number', min: '1', max: '180', value: '25' }),
                ]),
                h('label', { text: 'Break min' }, [
                    h('input', { name: 'pause', type: 'number', min: '0', max: '60', value: '5' }),
                ]),
            ]),
            h('button', { class: 'btn', name: 'save', type: 'submit', text: 'Add preset' }),
        ]),
    );
}
