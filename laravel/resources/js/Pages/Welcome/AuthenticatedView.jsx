import { Link } from '@inertiajs/react';
import { useState } from 'react';
import GlassCard from '@/Components/Glass/GlassCard';
import LiveClock from '@/Components/Glass/LiveClock';
import PillButton from '@/Components/Glass/PillButton';
import {
    BarsIcon,
    ClockIcon,
    GridIcon,
    PlusIcon,
    TimerIcon,
} from '@/Components/Glass/icons';
import { formatClock } from '@/Lib/formatClock';
import { useCountdown } from '@/Lib/useCountdown';

function QuickLink({ href, icon: Icon, label }) {
    return (
        <Link
            href={href}
            title={label}
            aria-label={label}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--ink)] transition hover:border-[var(--accent)]"
        >
            <Icon size={18} />
        </Link>
    );
}

function RailButton({ onClick, active, icon: Icon, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={
                'flex h-11 w-11 items-center justify-center rounded-full border transition ' +
                (active
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--ink)] hover:border-[var(--accent)]')
            }
        >
            <Icon size={18} />
        </button>
    );
}

function PomodoroDisplay({ timer, defaultPreset }) {
    if (!defaultPreset) {
        return (
            <div className="flex flex-col items-center gap-3">
                <p className="font-mono text-6xl font-bold tabular-nums sm:text-7xl lg:text-8xl">
                    --:--
                </p>
                <Link
                    href={route('pomodoro.index')}
                    className="text-sm font-semibold text-[var(--accent)] hover:underline"
                >
                    Set a default preset to start from here
                </Link>
            </div>
        );
    }

    const idle = timer.preset === null;
    const seconds = idle ? defaultPreset.focus_minutes * 60 : timer.secondsLeft;

    return (
        <div className="flex flex-col items-center gap-4">
            <p className="text-xs uppercase tracking-widest text-[var(--muted)]">
                {idle
                    ? defaultPreset.name
                    : `${timer.phase === 'focus' ? 'Focus' : 'Break'} · ${timer.preset.name}`}
            </p>
            <p className="font-mono text-6xl font-bold tabular-nums sm:text-7xl lg:text-8xl">
                {formatClock(seconds)}
            </p>
            <div className="flex gap-2">
                {idle ? (
                    <PillButton
                        primary
                        onClick={() => timer.start(defaultPreset)}
                    >
                        Start
                    </PillButton>
                ) : (
                    <>
                        {timer.running ? (
                            <PillButton onClick={timer.pause}>Pause</PillButton>
                        ) : (
                            <PillButton primary onClick={timer.resume}>
                                Resume
                            </PillButton>
                        )}
                        <PillButton onClick={timer.stop}>Stop</PillButton>
                    </>
                )}
            </div>
        </div>
    );
}

export default function AuthenticatedView({
    notes,
    dueForReminder,
    lastLoggedAt,
    defaultPreset,
}) {
    const [mode, setMode] = useState('clock');
    const timer = useCountdown();

    return (
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 p-6 lg:flex-row">
            <GlassCard
                title="Quick notes"
                action={
                    <Link
                        href={route('notes.create')}
                        aria-label="New note"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]"
                    >
                        <PlusIcon size={12} />
                    </Link>
                }
                className="w-full lg:w-64"
            >
                {notes.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No notes yet.</p>
                ) : (
                    <div className="flex flex-col">
                        {notes.map((note) => (
                            <Link
                                key={note.id}
                                href={route('notes.edit', note.id)}
                                className="truncate py-1.5 text-sm text-[var(--ink)] hover:text-[var(--accent)]"
                            >
                                {note.title}
                            </Link>
                        ))}
                    </div>
                )}
                <Link
                    href={route('notes.index')}
                    className="mt-3 block text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                    All notes
                </Link>
            </GlassCard>

            <div className="flex flex-1 flex-col items-center gap-4 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--muted)]">
                    Jack &amp; Things
                </p>
                {mode === 'clock' ? (
                    <LiveClock className="text-6xl sm:text-7xl lg:text-8xl" />
                ) : (
                    <PomodoroDisplay
                        timer={timer}
                        defaultPreset={defaultPreset}
                    />
                )}
                <div className="flex flex-wrap items-center justify-center gap-3 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-2.5 text-sm">
                    <span className="text-[var(--muted)]">
                        {dueForReminder
                            ? 'Nothing logged this hour'
                            : `Last workout: ${lastLoggedAt ?? 'none yet'}`}
                    </span>
                    <Link
                        href={route('workouts.create')}
                        className="font-semibold text-[var(--accent)] hover:underline"
                    >
                        Add Workout
                    </Link>
                </div>
            </div>

            <div className="flex gap-3 lg:flex-col">
                <RailButton
                    onClick={() =>
                        setMode((m) => (m === 'clock' ? 'pomodoro' : 'clock'))
                    }
                    active={mode === 'pomodoro'}
                    icon={mode === 'pomodoro' ? ClockIcon : TimerIcon}
                    label={
                        mode === 'pomodoro'
                            ? 'Show clock'
                            : 'Show Pomodoro timer'
                    }
                />
                <QuickLink
                    href={route('budget.index')}
                    icon={BarsIcon}
                    label="Budget"
                />
                <QuickLink
                    href={route('dashboard')}
                    icon={GridIcon}
                    label="Dashboard"
                />
            </div>
        </div>
    );
}
