import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PomodoroGlassView from './GlassView';
import { router, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

const PHASE_FOCUS = 'focus';
const PHASE_BREAK = 'break';

/**
 * The countdown is deliberately client-side only: nothing about a running timer
 * is persisted, so only presets round-trip to the server.
 */
function useCountdown() {
    const [preset, setPreset] = useState(null);
    const [phase, setPhase] = useState(PHASE_FOCUS);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [running, setRunning] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!running) {
            return undefined;
        }

        intervalRef.current = window.setInterval(() => {
            setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
        }, 1000);

        return () => window.clearInterval(intervalRef.current);
    }, [running]);

    useEffect(() => {
        if (secondsLeft !== 0 || !running || preset === null) {
            return;
        }

        // Focus rolls into the break, then the timer stops.
        if (phase === PHASE_FOCUS && preset.break_minutes > 0) {
            setPhase(PHASE_BREAK);
            setSecondsLeft(preset.break_minutes * 60);
        } else {
            setRunning(false);
        }
    }, [secondsLeft, running, phase, preset]);

    const start = (chosen) => {
        setPreset(chosen);
        setPhase(PHASE_FOCUS);
        setSecondsLeft(chosen.focus_minutes * 60);
        setRunning(true);
    };

    const stop = () => {
        setRunning(false);
        setSecondsLeft(0);
        setPreset(null);
        setPhase(PHASE_FOCUS);
    };

    return {
        preset,
        phase,
        secondsLeft,
        running,
        start,
        stop,
        pause: () => setRunning(false),
        resume: () => setRunning(true),
    };
}

export default function Index({ presets }) {
    const timer = useCountdown();

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

    return (
        <PomodoroGlassView
            presets={presets}
            timer={timer}
            presetForm={{ data, setData, errors, processing }}
            onSubmitPreset={submit}
            onDestroyPreset={destroy}
        />
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="pomodoro">{page}</AuthenticatedLayout>
);
