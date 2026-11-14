import { useEffect, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import TimerCard from './TimerCard';
import { usePomodoroTimer } from '@/Lib/PomodoroTimerContext';
import {
    setSoundsEnabled,
    soundsEnabled,
    soundsSupported,
} from '@/Lib/pomodoroSounds';
import { useAnalyticsTimezone } from './useAnalyticsTimezone';

/**
 * The Timer page — the Pomodoro module's landing page.
 *
 * Deliberately only the clock. Presets, the session log and the analytics are
 * their own pages now: the timer is what you open this module for, and having
 * to scroll past a chart and a history list to reach a countdown was the
 * reason for the split.
 *
 * The countdown is not owned here. It lives in PomodoroTimerProvider above
 * every authenticated page, so moving between these four pages — or away to
 * Notes and back — never disturbs a running session.
 */
export default function Index({ presets, today, timezone }) {
    const timer = usePomodoroTimer();
    const [soundOn, setSoundOn] = useState(false);

    // Read after mount: the answer depends on `window`, which is not there
    // during the first render of the server-rendered shell.
    useEffect(() => setSoundOn(soundsEnabled()), []);

    useAnalyticsTimezone(timezone, ['today', 'timezone']);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <TimerCard
                presets={presets}
                timer={timer}
                todaySeconds={today.focus_seconds}
                soundControl={{
                    supported: soundsSupported(),
                    enabled: soundOn,
                    toggle: () => setSoundOn(setSoundsEnabled(!soundOn)),
                }}
            />
        </div>
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="pomodoro">{page}</AuthenticatedLayout>
);
