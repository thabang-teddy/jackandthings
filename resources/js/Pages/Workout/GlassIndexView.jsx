import { Link, useForm } from '@inertiajs/react';
import GlassCard from '@/Components/Glass/GlassCard';
import GlassPagination from '@/Components/Glass/GlassPagination';
import PillButton from '@/Components/Glass/PillButton';
import TxRow from '@/Components/Glass/TxRow';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassSelect,
} from '@/Components/Glass/GlassFormControls';
import { BellIcon, HeartIcon } from '@/Components/Glass/icons';
import { formatWhen } from '@/Lib/formatWhen';
import LiveSessionCard from './LiveSessionCard';

function PresetManager({ presets, onDestroyPreset }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        activity: '',
    });

    const submit = (event) => {
        event.preventDefault();
        post(route('workouts.presets.store'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <GlassCard id="presets" title="Quick-log presets">
            {presets.length > 0 && (
                <div className="mb-3 flex flex-col gap-2">
                    {presets.map((preset) => (
                        <div
                            key={preset.id}
                            className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                    {preset.name}
                                </p>
                                <p className="truncate text-xs text-[var(--muted)]">
                                    {preset.activity}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onDestroyPreset(preset)}
                                className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--neg)]"
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <form
                onSubmit={submit}
                className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
            >
                <div>
                    <GlassLabel htmlFor="preset_name">Name</GlassLabel>
                    <GlassInput
                        id="preset_name"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        placeholder="Leg day"
                        required
                    />
                    <GlassError message={errors.name} />
                </div>
                <div>
                    <GlassLabel htmlFor="preset_activity">Activity</GlassLabel>
                    <GlassInput
                        id="preset_activity"
                        value={data.activity}
                        onChange={(e) => setData('activity', e.target.value)}
                        placeholder="Squats, lunges, calf raises"
                        required
                    />
                    <GlassError message={errors.activity} />
                </div>
                <div className="flex items-end">
                    <GlassButton type="submit" disabled={processing}>
                        Add
                    </GlassButton>
                </div>
            </form>
        </GlassCard>
    );
}

/**
 * Starts a tracked workout, from a routine or from nothing.
 *
 * A freestyle session is a deliberate option: the issue asks for routines, but
 * turning up and lifting without a plan is a real workout and refusing to track
 * it would be a worse tracker.
 */
function StartWorkoutCard({ routines }) {
    const { data, setData, post, processing } = useForm({
        workout_routine_id: '',
    });

    const submit = (event) => {
        event.preventDefault();
        post(route('workouts.sessions.store'), { preserveScroll: true });
    };

    return (
        <GlassCard title="Start a tracked workout">
            <form
                onSubmit={submit}
                className="grid gap-3 sm:grid-cols-[1fr_auto]"
            >
                <div>
                    <GlassLabel htmlFor="start_routine">Routine</GlassLabel>
                    <GlassSelect
                        id="start_routine"
                        value={data.workout_routine_id}
                        onChange={(event) =>
                            setData('workout_routine_id', event.target.value)
                        }
                    >
                        <option value="">No routine — freestyle</option>
                        {routines.map((routine) => (
                            <option key={routine.id} value={routine.id}>
                                {routine.name}
                            </option>
                        ))}
                    </GlassSelect>
                </div>
                <div className="flex items-end">
                    <GlassButton type="submit" disabled={processing}>
                        Start
                    </GlassButton>
                </div>
            </form>

            {routines.length === 0 && (
                <p className="mt-3 text-xs text-[var(--muted)]">
                    No routines yet —{' '}
                    <Link
                        href={route('workouts.routines')}
                        className="text-[#8BB4FF] hover:underline"
                    >
                        build one
                    </Link>{' '}
                    to get targets and automatic rest times.
                </p>
            )}
        </GlassCard>
    );
}

export default function WorkoutGlassIndexView({
    entries,
    presets = [],
    routines = [],
    exercises = [],
    openSession = null,
    dueForReminder,
    lastLoggedAt,
    onDestroy,
    onDestroyPreset,
}) {
    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
            <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--muted)]">
                    {entries.data.length} quick entr
                    {entries.data.length === 1 ? 'y' : 'ies'}
                </p>
                <PillButton href={route('workouts.create')} primary>
                    + Quick log
                </PillButton>
            </div>

            <div id="reminders">
                {dueForReminder ? (
                    <div
                        className="rounded-[22px] border p-5"
                        style={{
                            borderColor: 'var(--warn-border)',
                            background: 'var(--warn-bg)',
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <BellIcon
                                size={16}
                                style={{ color: 'var(--warn-ink)' }}
                            />
                            <div>
                                <p
                                    className="text-sm font-semibold"
                                    style={{ color: 'var(--warn-ink)' }}
                                >
                                    Nothing logged this hour
                                </p>
                                <p
                                    className="text-xs"
                                    style={{ color: 'var(--warn-muted)' }}
                                >
                                    {lastLoggedAt
                                        ? `Last activity: ${formatWhen(lastLoggedAt)}.`
                                        : 'Nothing logged yet.'}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <GlassCard>
                        <p className="text-sm text-[var(--muted)]">
                            You're up to date — last activity:{' '}
                            {lastLoggedAt
                                ? formatWhen(lastLoggedAt)
                                : 'none yet'}
                            .
                        </p>
                    </GlassCard>
                )}
            </div>

            {openSession ? (
                <LiveSessionCard
                    session={openSession}
                    routines={routines}
                    exercises={exercises}
                />
            ) : (
                <StartWorkoutCard routines={routines} />
            )}

            <PresetManager
                presets={presets}
                onDestroyPreset={onDestroyPreset}
            />

            <GlassCard id="overview" title="Quick entries">
                {entries.data.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        The quick log is for anything you don't want to track
                        set by set — a walk, a swim, a class.
                    </p>
                ) : (
                    entries.data.map((entry) => (
                        <TxRow
                            key={entry.id}
                            icon={<HeartIcon size={14} />}
                            iconColor="#D4537E"
                            title={entry.activity}
                            subtitle={
                                (entry.notes ? `${entry.notes} · ` : '') +
                                formatWhen(entry.logged_at)
                            }
                            action={
                                <div className="ml-2 flex shrink-0 items-center gap-3 text-xs">
                                    <Link
                                        href={route('workouts.edit', entry.id)}
                                        className="text-[#8BB4FF] hover:underline"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => onDestroy(entry)}
                                        className="text-[var(--muted)] hover:text-[var(--neg)]"
                                    >
                                        Delete
                                    </button>
                                </div>
                            }
                        />
                    ))
                )}
            </GlassCard>

            <GlassPagination links={entries.links} />
        </div>
    );
}
