import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PageShell from '@/Components/PageShell';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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

function formatClock(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
        <PageShell title="Pomodoro">
            <div className="mb-6 rounded-lg bg-white p-8 text-center shadow-sm dark:bg-gray-800">
                {timer.preset ? (
                    <>
                        <p className="text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400">
                            {timer.phase === PHASE_FOCUS ? 'Focus' : 'Break'} ·{' '}
                            {timer.preset.name}
                        </p>
                        <p className="my-4 font-mono text-6xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {formatClock(timer.secondsLeft)}
                        </p>
                        <div className="flex justify-center gap-3">
                            {timer.running ? (
                                <SecondaryButton onClick={timer.pause}>
                                    Pause
                                </SecondaryButton>
                            ) : (
                                <PrimaryButton onClick={timer.resume}>
                                    Resume
                                </PrimaryButton>
                            )}
                            <SecondaryButton onClick={timer.stop}>
                                Stop
                            </SecondaryButton>
                        </div>
                    </>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">
                        Pick a preset below to start a session.
                    </p>
                )}
            </div>

            <h2 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
                Presets
            </h2>

            {presets.length === 0 ? (
                <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                    No presets yet — add one below.
                </p>
            ) : (
                <ul className="mb-6 grid gap-3 sm:grid-cols-2">
                    {presets.map((preset) => (
                        <li
                            key={preset.id}
                            className="flex items-center justify-between gap-4 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800"
                        >
                            <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    {preset.name}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {preset.focus_minutes} min focus ·{' '}
                                    {preset.break_minutes} min break
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                                <PrimaryButton
                                    onClick={() => timer.start(preset)}
                                >
                                    Start
                                </PrimaryButton>
                                <button
                                    type="button"
                                    onClick={() => destroy(preset)}
                                    className="text-sm text-red-600 hover:underline dark:text-red-400"
                                >
                                    Delete
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <form
                onSubmit={submit}
                className="space-y-4 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800"
            >
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    New preset
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                        <InputLabel htmlFor="name" value="Name" />
                        <TextInput
                            id="name"
                            className="mt-1 block w-full"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="Deep work"
                            required
                        />
                        <InputError className="mt-2" message={errors.name} />
                    </div>
                    <div>
                        <InputLabel
                            htmlFor="focus_minutes"
                            value="Focus minutes"
                        />
                        <TextInput
                            id="focus_minutes"
                            type="number"
                            min="1"
                            max="180"
                            className="mt-1 block w-full"
                            value={data.focus_minutes}
                            onChange={(e) =>
                                setData('focus_minutes', e.target.value)
                            }
                            required
                        />
                        <InputError
                            className="mt-2"
                            message={errors.focus_minutes}
                        />
                    </div>
                    <div>
                        <InputLabel
                            htmlFor="break_minutes"
                            value="Break minutes"
                        />
                        <TextInput
                            id="break_minutes"
                            type="number"
                            min="0"
                            max="60"
                            className="mt-1 block w-full"
                            value={data.break_minutes}
                            onChange={(e) =>
                                setData('break_minutes', e.target.value)
                            }
                            required
                        />
                        <InputError
                            className="mt-2"
                            message={errors.break_minutes}
                        />
                    </div>
                </div>
                <PrimaryButton disabled={processing}>Add preset</PrimaryButton>
            </form>
        </PageShell>
    );
}

Index.layout = (page) => <AuthenticatedLayout>{page}</AuthenticatedLayout>;
