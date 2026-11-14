import { api } from '../../lib/api.js';
import { h, guard } from '../../lib/dom.js';

/**
 * The preset editor, in a popup that is about 360px wide.
 *
 * The option lists are this client's copy of the server enums
 * (App\Enums\PomodoroSound / PomodoroTicking / PomodoroAmbience). Wire value
 * and label are kept apart so the thing sent is never the thing displayed - a
 * label change cannot quietly break validation.
 */

const ALARM_SOUNDS = [
    ['none', 'None'],
    ['chime', 'Chime'],
    ['bell', 'Bell'],
    ['digital', 'Digital'],
    ['marimba', 'Marimba'],
];

const TICK_SOUNDS = [
    ['none', 'None'],
    ['clock', 'Clock tick'],
    ['soft', 'Soft tick'],
];

const AMBIENCE = [
    ['none', 'None'],
    ['rain', 'Rain'],
    ['cafe', 'Cafe'],
    ['white_noise', 'White noise'],
    ['brown_noise', 'Brown noise'],
    ['lofi', 'Lo-fi loop'],
];

function select(name, options, selected) {
    return h(
        'select',
        { name },
        options.map(([value, label]) =>
            h('option', { value, text: label, selected: value === selected }),
        ),
    );
}

function number(name, value, { min = 0, max = 180 } = {}) {
    return h('input', {
        name,
        type: 'number',
        min: String(min),
        max: String(max),
        value: String(value),
    });
}

function checkbox(name, checked) {
    return h('input', { name, type: 'checkbox', checked });
}

/** The form's fields as the wire payload the server validates. */
function payloadFrom(form) {
    const fields = form.elements;
    const blocked = fields.blocked.value
        .split(/[\s,]+/)
        .map((site) => site.trim())
        .filter(Boolean);

    return {
        name: fields.name.value.trim(),
        focus_minutes: Number(fields.focus.value),
        break_minutes: Number(fields.pause.value),
        long_break_minutes: Number(fields.longBreak.value),
        cycles_before_long_break: Number(fields.cycles.value),
        auto_start_breaks: fields.autoBreaks.checked,
        auto_start_focus: fields.autoFocus.checked,
        tag: fields.tag.value.trim() || null,
        alarm_sound: fields.alarm.value,
        ticking_sound: fields.ticking.value,
        ambience: fields.ambience.value,
        strict_mode: fields.strict.checked,
        blocked_sites: blocked,
    };
}

export function renderPresetForm({ view, editing, knownTags, onDone }) {
    const preset = editing ?? {};

    const tagList = h(
        'datalist',
        { id: 'jack-tag-options' },
        knownTags.map((tag) => h('option', { value: tag })),
    );

    return h(
        'form',
        {
            class: 'card stack',
            onSubmit: (event) => {
                event.preventDefault();
                const form = event.target;
                const body = payloadFrom(form);

                if (!body.name || !Number.isFinite(body.focus_minutes) || body.focus_minutes < 1) {
                    return;
                }

                form.elements.save.disabled = true;
                guard(view, async () => {
                    if (editing) {
                        await api.updatePreset(editing.id, body);
                    } else {
                        await api.createPreset(body);
                    }
                    await onDone();
                });
            },
        },
        [
            h('strong', { text: editing ? `Editing ${editing.name}` : 'New preset' }),

            h('label', { text: 'Name' }, [
                h('input', {
                    name: 'name',
                    required: true,
                    placeholder: 'Deep work',
                    value: preset.name ?? '',
                }),
            ]),

            h('div', { class: 'split' }, [
                h('label', { text: 'Focus min' }, [
                    number('focus', preset.focus_minutes ?? 25, { min: 1, max: 180 }),
                ]),
                h('label', { text: 'Break min' }, [
                    number('pause', preset.break_minutes ?? 5, { max: 60 }),
                ]),
            ]),

            h('div', { class: 'split' }, [
                h('label', { text: 'Long break min' }, [
                    number('longBreak', preset.long_break_minutes ?? 15, { max: 120 }),
                ]),
                h('label', { text: 'Runs per long' }, [
                    number('cycles', preset.cycles_before_long_break ?? 4, { min: 1, max: 12 }),
                ]),
            ]),

            h('label', { class: 'check' }, [
                checkbox('autoBreaks', preset.auto_start_breaks !== false),
                h('span', { text: ' Start breaks automatically' }),
            ]),
            h('label', { class: 'check' }, [
                checkbox('autoFocus', preset.auto_start_focus === true),
                h('span', { text: ' Start the next focus run automatically' }),
            ]),

            h('label', { text: 'Tag' }, [
                h('input', {
                    name: 'tag',
                    placeholder: 'Coding',
                    maxlength: '40',
                    list: 'jack-tag-options',
                    value: preset.tag ?? '',
                }),
                tagList,
            ]),

            h('label', { text: 'Alarm' }, [
                select('alarm', ALARM_SOUNDS, preset.alarm_sound ?? 'chime'),
            ]),
            h('label', { text: 'Ticking' }, [
                select('ticking', TICK_SOUNDS, preset.ticking_sound ?? 'none'),
            ]),
            h('label', { text: 'Background sound' }, [
                select('ambience', AMBIENCE, preset.ambience ?? 'none'),
            ]),

            h('label', { class: 'check' }, [
                checkbox('strict', preset.strict_mode === true),
                h('span', { text: ' Strict mode: block the sites below while focusing' }),
            ]),
            h('label', { text: 'Blocked sites (one per line)' }, [
                h('textarea', {
                    name: 'blocked',
                    rows: '3',
                    placeholder: 'news.ycombinator.com',
                    value: (preset.blocked_sites ?? []).join('\n'),
                }),
            ]),

            h('div', { class: 'split' }, [
                h('button', {
                    class: 'btn',
                    name: 'save',
                    type: 'submit',
                    text: editing ? 'Save changes' : 'Add preset',
                }),
                editing
                    ? h('button', {
                          class: 'btn-ghost',
                          type: 'button',
                          text: 'Cancel',
                          onClick: () => onDone(),
                      })
                    : null,
            ].filter(Boolean)),
        ],
    );
}
