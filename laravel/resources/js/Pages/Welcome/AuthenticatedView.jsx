import { Link, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AlertsBell from '@/Components/Glass/AlertsBell';
import GlassCard from '@/Components/Glass/GlassCard';
import GlassDateTimePicker from '@/Components/Glass/GlassDateTimePicker';
import GlassModal from '@/Components/Glass/GlassModal';
import LiveClock from '@/Components/Glass/LiveClock';
import PillButton from '@/Components/Glass/PillButton';
import {
    BarsIcon,
    ClockIcon,
    ForwardIcon,
    GridIcon,
    PauseIcon,
    PlayIcon,
    PlusIcon,
    RepeatIcon,
    StarIcon,
    StarOutlineIcon,
    StopIcon,
    TimerIcon,
} from '@/Components/Glass/icons';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassSelect,
    GlassTextarea,
} from '@/Components/Glass/GlassFormControls';
import { formatClock } from '@/Lib/formatClock';
import { formatWhen } from '@/Lib/formatWhen';
import { usePomodoroTimer } from '@/Lib/PomodoroTimerContext';
import { useWorkoutNudge } from '@/Lib/useWorkoutNudge';

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
                        ariaLabel="Start"
                    >
                        <PlayIcon size={14} />
                    </PillButton>
                ) : (
                    <>
                        <PillButton onClick={timer.restart} ariaLabel="Restart">
                            <RepeatIcon size={14} />
                        </PillButton>
                        {timer.running ? (
                            <PillButton onClick={timer.pause} ariaLabel="Pause">
                                <PauseIcon size={14} />
                            </PillButton>
                        ) : (
                            <PillButton
                                primary
                                onClick={timer.resume}
                                ariaLabel="Resume"
                            >
                                <PlayIcon size={14} />
                            </PillButton>
                        )}
                        <PillButton onClick={timer.skip} ariaLabel="Skip">
                            <ForwardIcon size={14} />
                        </PillButton>
                        <PillButton onClick={timer.stop} ariaLabel="Stop">
                            <StopIcon size={14} />
                        </PillButton>
                    </>
                )}
            </div>
        </div>
    );
}

export default function AuthenticatedView({
    notes,
    presets = [],
    dueForReminder,
    lastLoggedAt,
    defaultPreset,
}) {
    const [mode, setMode] = useState('clock');
    const [noteOpen, setNoteOpen] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [workoutOpen, setWorkoutOpen] = useState(false);
    const timer = usePomodoroTimer();

    // This page sits outside AuthenticatedLayout, which is where every other
    // page picks the hourly nudge up.
    useWorkoutNudge(route('workouts.due'));

    // `return_to` tells NoteController@store/@update to come back here rather
    // than sending the user to the Notes module; NoteRequest ignores the field.
    // A note written on this card starts starred, because this card shows
    // starred notes only - an unstarred one would vanish the moment it saved.
    const noteForm = useForm({
        title: '',
        body: '',
        is_starred: true,
        return_to: 'home',
    });

    const openNewNote = () => {
        setEditingNote(null);
        noteForm.reset();
        noteForm.clearErrors();
        setNoteOpen(true);
    };

    const openNote = (note) => {
        setEditingNote(note);
        noteForm.setData({
            title: note.title,
            body: note.body ?? '',
            is_starred: note.is_starred ?? true,
            return_to: 'home',
        });
        noteForm.clearErrors();
        setNoteOpen(true);
    };

    const closeNote = () => {
        setNoteOpen(false);
        setEditingNote(null);
        noteForm.reset();
    };

    const submitNote = (event) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            // Keep the clock/mode and a running Pomodoro untouched by the
            // reload this save triggers.
            preserveState: true,
            onSuccess: closeNote,
        };

        if (editingNote) {
            noteForm.put(route('notes.update', editingNote.id), options);
        } else {
            noteForm.post(route('notes.store'), options);
        }
    };

    // Same `return_to` handshake as the note popup: WorkoutEntryController@store
    // comes back here so the popup closes and the "last workout" line refreshes.
    const workoutForm = useForm({
        activity: '',
        logged_at: '',
        notes: '',
        return_to: 'home',
    });

    const openWorkout = () => {
        workoutForm.reset();
        workoutForm.clearErrors();
        setWorkoutOpen(true);
    };

    const closeWorkout = () => {
        setWorkoutOpen(false);
        workoutForm.reset();
    };

    const submitWorkout = (event) => {
        event.preventDefault();

        workoutForm.post(route('workouts.store'), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: closeWorkout,
        });
    };

    return (
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 p-6 lg:flex-row">
            <GlassCard
                title="Starred notes"
                action={
                    <button
                        type="button"
                        onClick={openNewNote}
                        aria-label="New note"
                        title="New note"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] transition hover:opacity-90"
                    >
                        <PlusIcon size={12} />
                    </button>
                }
                className="w-full lg:w-64"
            >
                {notes.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        No starred notes. Star one in Notes to pin it here.
                    </p>
                ) : (
                    <div className="flex flex-col">
                        {notes.map((note) => (
                            <button
                                key={note.id}
                                type="button"
                                onClick={() => openNote(note)}
                                title={`Edit ${note.title}`}
                                className="w-full truncate py-1.5 text-left text-sm text-[var(--ink)] hover:text-[var(--accent)]"
                            >
                                {note.title}
                            </button>
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
                            : `Last workout: ${lastLoggedAt ? formatWhen(lastLoggedAt) : 'none yet'}`}
                    </span>
                    <button
                        type="button"
                        onClick={openWorkout}
                        aria-haspopup="dialog"
                        className="font-semibold text-[var(--accent)] hover:underline"
                    >
                        Add Workout
                    </button>
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
                {/* This page has its own chrome rather than GlassShell's, so
                    the alerts toggle has to be offered here too. */}
                <AlertsBell />
            </div>

            <GlassModal
                show={noteOpen}
                onClose={closeNote}
                title={editingNote ? 'Edit note' : 'New note'}
            >
                <form onSubmit={submitNote} className="grid gap-3">
                    <div>
                        <GlassLabel htmlFor="home_note_title">Title</GlassLabel>
                        <GlassInput
                            id="home_note_title"
                            autoFocus
                            maxLength={255}
                            value={noteForm.data.title}
                            onChange={(event) =>
                                noteForm.setData('title', event.target.value)
                            }
                            placeholder="Shopping list"
                        />
                        <GlassError message={noteForm.errors.title} />
                    </div>
                    <div>
                        <GlassLabel htmlFor="home_note_body">
                            Note (optional)
                        </GlassLabel>
                        <GlassTextarea
                            id="home_note_body"
                            rows={4}
                            value={noteForm.data.body}
                            onChange={(event) =>
                                noteForm.setData('body', event.target.value)
                            }
                            placeholder="Milk, bread, coffee"
                        />
                        <GlassError message={noteForm.errors.body} />
                    </div>
                    <button
                        type="button"
                        onClick={() =>
                            noteForm.setData(
                                'is_starred',
                                !noteForm.data.is_starred,
                            )
                        }
                        aria-pressed={noteForm.data.is_starred}
                        className={
                            'flex items-center gap-2 self-start text-xs font-semibold transition ' +
                            (noteForm.data.is_starred
                                ? 'text-[var(--accent)]'
                                : 'text-[var(--muted)] hover:text-[var(--ink)]')
                        }
                    >
                        {noteForm.data.is_starred ? (
                            <StarIcon size={13} />
                        ) : (
                            <StarOutlineIcon size={13} />
                        )}
                        {noteForm.data.is_starred
                            ? 'Shows on this page'
                            : 'Not on this page'}
                    </button>
                    <div className="mt-1 flex items-center justify-end gap-2">
                        <PillButton onClick={closeNote}>Cancel</PillButton>
                        <GlassButton
                            type="submit"
                            disabled={noteForm.processing}
                        >
                            {editingNote ? 'Save changes' : 'Save note'}
                        </GlassButton>
                    </div>
                </form>
            </GlassModal>

            <GlassModal
                show={workoutOpen}
                onClose={closeWorkout}
                title="Log workout"
            >
                <form onSubmit={submitWorkout} className="grid gap-3">
                    {presets.length > 0 && (
                        <div>
                            <GlassLabel htmlFor="home_workout_preset">
                                Preset (optional)
                            </GlassLabel>
                            <GlassSelect
                                id="home_workout_preset"
                                value=""
                                onChange={(event) => {
                                    const preset = presets.find(
                                        (candidate) =>
                                            candidate.id === event.target.value,
                                    );
                                    if (preset) {
                                        workoutForm.setData(
                                            'activity',
                                            preset.activity,
                                        );
                                    }
                                }}
                            >
                                <option value="">Pick a preset…</option>
                                {presets.map((preset) => (
                                    <option key={preset.id} value={preset.id}>
                                        {preset.name}
                                    </option>
                                ))}
                            </GlassSelect>
                        </div>
                    )}
                    <div>
                        <GlassLabel htmlFor="home_workout_activity">
                            Activity
                        </GlassLabel>
                        <GlassInput
                            id="home_workout_activity"
                            autoFocus
                            maxLength={100}
                            value={workoutForm.data.activity}
                            onChange={(event) =>
                                workoutForm.setData(
                                    'activity',
                                    event.target.value,
                                )
                            }
                            placeholder="Push-ups, 5km run, gym session…"
                        />
                        <GlassError message={workoutForm.errors.activity} />
                    </div>
                    <div>
                        <GlassLabel htmlFor="home_workout_logged_at">
                            When (defaults to now)
                        </GlassLabel>
                        <GlassDateTimePicker
                            id="home_workout_logged_at"
                            value={workoutForm.data.logged_at}
                            onChange={(next) =>
                                workoutForm.setData('logged_at', next)
                            }
                        />
                        <GlassError message={workoutForm.errors.logged_at} />
                    </div>
                    <div>
                        <GlassLabel htmlFor="home_workout_notes">
                            Notes (optional)
                        </GlassLabel>
                        <GlassTextarea
                            id="home_workout_notes"
                            rows={3}
                            maxLength={1000}
                            value={workoutForm.data.notes}
                            onChange={(event) =>
                                workoutForm.setData('notes', event.target.value)
                            }
                            placeholder="Felt strong, 3 sets of 12"
                        />
                        <GlassError message={workoutForm.errors.notes} />
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-2">
                        <PillButton onClick={closeWorkout}>Cancel</PillButton>
                        <GlassButton
                            type="submit"
                            disabled={workoutForm.processing}
                        >
                            Log it
                        </GlassButton>
                    </div>
                </form>
            </GlassModal>
        </div>
    );
}
