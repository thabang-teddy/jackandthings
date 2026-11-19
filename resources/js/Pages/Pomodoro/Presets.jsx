import { useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PresetList from './PresetList';
import PresetForm from './PresetForm';
import { usePomodoroTimer } from '@/Lib/PomodoroTimerContext';
import { alarm } from '@/Lib/pomodoroSounds';

/**
 * The Presets page: the saved presets and the editor for them.
 *
 * Starting a preset from here is still possible — it sets the shared timer
 * and the floating ring picks it straight up, so you are not sent back to the
 * Timer page to press play.
 */

/**
 * A preset's form shape. Blocked sites are one textarea here and an array on
 * the wire; PomodoroPresetRequest::prepareForValidation does that conversion,
 * so the form keeps the shape that is pleasant to type into.
 */
const BLANK_PRESET = {
    name: '',
    focus_minutes: 25,
    break_minutes: 5,
    long_break_minutes: 15,
    cycles_before_long_break: 4,
    auto_start_breaks: true,
    auto_start_focus: false,
    tag: '',
    alarm_sound: 'chime',
    ticking_sound: 'none',
    ambience: 'none',
    strict_mode: false,
    blocked_sites: '',
};

function formValuesFor(preset) {
    return {
        name: preset.name,
        focus_minutes: preset.focus_minutes,
        break_minutes: preset.break_minutes,
        long_break_minutes: preset.long_break_minutes,
        cycles_before_long_break: preset.cycles_before_long_break,
        auto_start_breaks: preset.auto_start_breaks,
        auto_start_focus: preset.auto_start_focus,
        tag: preset.tag ?? '',
        alarm_sound: preset.alarm_sound,
        ticking_sound: preset.ticking_sound,
        ambience: preset.ambience,
        strict_mode: preset.strict_mode,
        blocked_sites: (preset.blocked_sites ?? []).join('\n'),
    };
}

export default function Presets({ presets, tags }) {
    const timer = usePomodoroTimer();
    const [editing, setEditing] = useState(null);

    const form = useForm(BLANK_PRESET);
    const { data, setData, post, put, processing, errors, reset, clearErrors } =
        form;

    const startEditing = (preset) => {
        setEditing(preset);
        clearErrors();
        setData(formValuesFor(preset));
    };

    const cancelEditing = () => {
        setEditing(null);
        clearErrors();
        reset();
    };

    const submit = (event) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setEditing(null);
                reset();
            },
        };

        if (editing) {
            put(route('pomodoro.presets.update', editing.id), options);

            return;
        }

        post(route('pomodoro.presets.store'), options);
    };

    const destroy = (preset) => {
        if (!window.confirm(`Delete preset "${preset.name}"?`)) {
            return;
        }

        // Logged intervals survive this: the row keeps its own preset_name and
        // the foreign key goes null, so the analytics do not lose last week.
        router.delete(route('pomodoro.presets.destroy', preset.id), {
            preserveScroll: true,
            onSuccess: () => {
                if (editing?.id === preset.id) {
                    cancelEditing();
                }
            },
        });
    };

    const setDefault = (preset) => {
        router.put(
            route('pomodoro.presets.update', preset.id),
            { ...formValuesFor(preset), is_default: !preset.is_default },
            { preserveScroll: true },
        );
    };

    return (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <PresetList
                presets={presets}
                editingId={editing?.id ?? null}
                onStart={timer.start}
                onEdit={startEditing}
                onDestroy={destroy}
                onSetDefault={setDefault}
            />
            <PresetForm
                form={{ data, setData, errors, processing }}
                tags={tags}
                editing={editing}
                onSubmit={submit}
                onCancelEdit={cancelEditing}
                // A preview has to play from the click itself: browsers only
                // let a page start audio from a real user gesture.
                onPreviewAlarm={(name) => alarm(name)}
            />
        </div>
    );
}

Presets.layout = (page) => (
    <AuthenticatedLayout module="pomodoro">{page}</AuthenticatedLayout>
);
