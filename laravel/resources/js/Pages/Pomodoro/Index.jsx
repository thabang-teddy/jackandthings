import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PomodoroGlassView from './GlassView';
import { usePomodoroTimer } from '@/Lib/PomodoroTimerContext';
import { router, useForm } from '@inertiajs/react';

export default function Index({ presets }) {
    const timer = usePomodoroTimer();

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        focus_minutes: 25,
        break_minutes: 5,
    });

    const submit = (event) => {
        event.preventDefault();
        post(route('pomodoro.presets.store'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    const destroy = (preset) => {
        if (window.confirm(`Delete preset "${preset.name}"?`)) {
            router.delete(route('pomodoro.presets.destroy', preset.id), {
                preserveScroll: true,
            });
        }
    };

    const setDefault = (preset) => {
        router.put(
            route('pomodoro.presets.update', preset.id),
            {
                name: preset.name,
                focus_minutes: preset.focus_minutes,
                break_minutes: preset.break_minutes,
                is_default: !preset.is_default,
            },
            { preserveScroll: true },
        );
    };

    return (
        <PomodoroGlassView
            presets={presets}
            timer={timer}
            presetForm={{ data, setData, errors, processing }}
            onSubmitPreset={submit}
            onDestroyPreset={destroy}
            onSetDefault={setDefault}
        />
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="pomodoro">{page}</AuthenticatedLayout>
);
