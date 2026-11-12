import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    ForwardIcon,
    PauseIcon,
    PlayIcon,
    RepeatIcon,
    StopIcon,
} from '@/Components/Glass/icons';
import { formatClock } from '@/Lib/formatClock';
import { usePomodoroTimer } from '@/Lib/PomodoroTimerContext';

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function totalSecondsFor(timer) {
    const minutes =
        timer.phase === 'focus'
            ? timer.preset.focus_minutes
            : timer.preset.break_minutes;
    return Math.max(minutes * 60, 1);
}

function RingButton({ onClick, label, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--card-border)] hover:text-[var(--ink)]"
        >
            {children}
        </button>
    );
}

/**
 * A small floating countdown that follows the signed-in user across every
 * page (see AuthenticatedLayout) while a Pomodoro session is active, so a
 * timer started elsewhere never looks like it stopped just because the page
 * changed. Hidden on the Pomodoro page itself, where the full Overview card
 * already shows the same clock and controls.
 */
export default function PomodoroFloatingRing() {
    const timer = usePomodoroTimer();
    const { component } = usePage();
    const [expanded, setExpanded] = useState(false);

    if (!timer.preset || component === 'Pomodoro/Index') {
        return null;
    }

    const total = totalSecondsFor(timer);
    const remaining = Math.min(Math.max(timer.secondsLeft, 0), total);
    const offset = CIRCUMFERENCE * (1 - remaining / total);

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
            <div
                className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] p-1.5 shadow-lg backdrop-blur"
                onMouseEnter={() => setExpanded(true)}
                onMouseLeave={() => setExpanded(false)}
            >
                <Link
                    href={route('pomodoro.index')}
                    title="Open Pomodoro"
                    className="relative flex h-14 w-14 shrink-0 items-center justify-center"
                >
                    <svg viewBox="0 0 60 60" className="h-14 w-14 -rotate-90">
                        <circle
                            cx="30"
                            cy="30"
                            r={RADIUS}
                            fill="none"
                            stroke="var(--card-border)"
                            strokeWidth="4"
                        />
                        <circle
                            cx="30"
                            cy="30"
                            r={RADIUS}
                            fill="none"
                            stroke="var(--accent)"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={CIRCUMFERENCE}
                            strokeDashoffset={offset}
                        />
                    </svg>
                    <span className="absolute font-mono text-[11px] font-bold tabular-nums text-[var(--ink)]">
                        {formatClock(timer.secondsLeft)}
                    </span>
                </Link>

                <div
                    className={
                        'flex items-center overflow-hidden transition-all ' +
                        (expanded
                            ? 'w-32 gap-0.5 pr-1 opacity-100'
                            : 'w-0 opacity-0')
                    }
                >
                    <RingButton label="Restart" onClick={timer.restart}>
                        <RepeatIcon size={13} />
                    </RingButton>
                    {timer.running ? (
                        <RingButton label="Pause" onClick={timer.pause}>
                            <PauseIcon size={13} />
                        </RingButton>
                    ) : (
                        <RingButton label="Resume" onClick={timer.resume}>
                            <PlayIcon size={13} />
                        </RingButton>
                    )}
                    <RingButton label="Skip" onClick={timer.skip}>
                        <ForwardIcon size={13} />
                    </RingButton>
                    <RingButton label="Stop" onClick={timer.stop}>
                        <StopIcon size={13} />
                    </RingButton>
                </div>
            </div>
        </div>
    );
}
