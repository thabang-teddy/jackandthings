import { useEffect, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PomodoroGlassView from './GlassView';
import { usePomodoroTimer } from '@/Lib/PomodoroTimerContext';
import { router, useForm } from '@inertiajs/react';
import {
    alarm,
    setSoundsEnabled,
    soundsEnabled,
    soundsSupported,
} from '@/Lib/pomodoroSounds';
import { currentTimezone } from '@/Lib/pomodoroSessionLog';

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

export default function Index({ presets, analytics, recentSessions, tags }) {
    const timer = usePomodoroTimer();
    const [editing, setEditing] = useState(null);
    const [soundOn, setSoundOn] = useState(false);

    // Read after mount: both answers depend on `window`, which is not there
    // during Inertia's first render on the server-rendered shell.
    useEffect(() => setSoundOn(soundsEnabled()), []);

    /**
     * The server buckets the analytics in whatever zone the request names, and
     * defaults to UTC. The first render of this page comes from a plain
     * navigation with no zone on it, so re-ask once with the real one -
     * otherwise an evening session shows up on yesterday.
     */
    useEffect(() => {
        const zone = currentTimezone();
        if (!zone || analytics.timezone === zone) {
            return;
        }

        router.reload({
            only: ['analytics'],
            data: { tz: zone },
            preserveScroll: true,
            preserveState: true,
        });
    }, [analytics.timezone]);

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

    const destroySession = (session) => {
        if (!window.confirm('Remove this session from your history?')) {
            return;
        }

        router.delete(route('pomodoro.sessions.destroy', session.id), {
            preserveScroll: true,
            data: { tz: currentTimezone() },
        });
    };

    const setDefault = (preset) => {
        router.put(
            route('pomodoro.presets.update', preset.id),
            { ...formValuesFor(preset), is_default: !preset.is_default },
            { preserveScroll: true },
        );
    };

    const toggleSound = () => setSoundOn(setSoundsEnabled(!soundOn));

    return (
        <PomodoroGlassView
            presets={presets}
            analytics={analytics}
            recentSessions={recentSessions}
            tags={tags}
            timer={timer}
            presetForm={{ data, setData, errors, processing }}
            editing={editing}
            soundControl={{
                supported: soundsSupported(),
                enabled: soundOn,
                toggle: toggleSound,
            }}
            onSubmitPreset={submit}
            onCancelEdit={cancelEditing}
            onEditPreset={startEditing}
            onDestroyPreset={destroy}
            onDestroySession={destroySession}
            onSetDefault={setDefault}
            // A preview has to play from the click itself: browsers only let a
            // page start audio from a real user gesture.
            onPreviewAlarm={(name) => alarm(name)}
        />
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="pomodoro">{page}</AuthenticatedLayout>
);
