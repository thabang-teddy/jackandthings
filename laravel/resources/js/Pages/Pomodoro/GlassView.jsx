import { useRef } from 'react';
import GlassCard from '@/Components/Glass/GlassCard';
import PillButton from '@/Components/Glass/PillButton';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassSelect,
} from '@/Components/Glass/GlassFormControls';
import {
    CompressIcon,
    ExpandIcon,
    ForwardIcon,
    PauseIcon,
    PlayIcon,
    RepeatIcon,
    StarIcon,
    StarOutlineIcon,
    StopIcon,
} from '@/Components/Glass/icons';
import { formatClock } from '@/Lib/formatClock';
import { useFullscreen } from '@/Lib/useFullscreen';

const PHASE_MESSAGES = {
    focus: 'Time to focus',
    break: 'Take a short break',
};

function PomodoroOverview({ presets, timer }) {
    const overviewRef = useRef(null);
    const { isFullscreen, toggle } = useFullscreen(overviewRef);

    const onSelectPreset = (event) => {
        const chosen = presets.find(
            (preset) => preset.id === event.target.value,
        );
        if (chosen) {
            timer.select(chosen);
        }
    };

    return (
        <GlassCard
            id="timer"
            title="Overview"
            action={
                <button
                    type="button"
                    onClick={toggle}
                    title={isFullscreen ? 'Exit full screen' : 'Full screen'}
                    aria-label={
                        isFullscreen ? 'Exit full screen' : 'Full screen'
                    }
                    className="text-[var(--muted)] hover:text-[var(--ink)]"
                >
                    {isFullscreen ? (
                        <CompressIcon size={14} />
                    ) : (
                        <ExpandIcon size={14} />
                    )}
                </button>
            }
        >
            <div
                ref={overviewRef}
                className={
                    isFullscreen
                        ? 'flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--bg)] p-6'
                        : 'flex flex-col items-center gap-4 py-2'
                }
            >
                <GlassSelect
                    value={timer.preset?.id ?? ''}
                    onChange={onSelectPreset}
                    disabled={presets.length === 0}
                    className="max-w-xs"
                >
                    <option value="" disabled>
                        {presets.length === 0
                            ? 'No presets yet'
                            : 'Select a preset…'}
                    </option>
                    {presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                            {preset.name}
                        </option>
                    ))}
                </GlassSelect>

                <p className="text-xs uppercase tracking-widest text-[var(--muted)]">
                    {timer.preset
                        ? `${timer.phase === 'focus' ? 'Focus' : 'Break'} · ${PHASE_MESSAGES[timer.phase]} · ${timer.preset.name}`
                        : 'Pick a preset to start a session'}
                </p>

                <p className="my-1 font-mono text-5xl font-bold tabular-nums">
                    {formatClock(timer.secondsLeft)}
                </p>

                <div className="flex gap-2">
                    <PillButton
                        onClick={timer.restart}
                        disabled={!timer.preset}
                        ariaLabel="Restart"
                    >
                        <RepeatIcon size={14} />
                    </PillButton>
                    {timer.running ? (
                        <PillButton
                            primary
                            onClick={timer.pause}
                            ariaLabel="Pause"
                        >
                            <PauseIcon size={14} />
                        </PillButton>
                    ) : (
                        <PillButton
                            primary
                            onClick={timer.resume}
                            disabled={!timer.preset}
                            ariaLabel="Start"
                        >
                            <PlayIcon size={14} />
                        </PillButton>
                    )}
                    <PillButton
                        onClick={timer.skip}
                        disabled={!timer.preset}
                        ariaLabel="Skip"
                    >
                        <ForwardIcon size={14} />
                    </PillButton>
                    <PillButton
                        onClick={timer.stop}
                        disabled={!timer.preset}
                        ariaLabel="Stop"
                    >
                        <StopIcon size={14} />
                    </PillButton>
                </div>
            </div>
        </GlassCard>
    );
}

export default function PomodoroGlassView({
    presets,
    timer,
    presetForm,
    onSubmitPreset,
    onDestroyPreset,
    onSetDefault,
}) {
    const { data, setData, errors, processing } = presetForm;

    return (
        <div className="flex h-full min-h-0 flex-col gap-4">
            <PomodoroOverview presets={presets} timer={timer} />

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
                <GlassCard
                    id="presets"
                    title="Presets"
                    className="overflow-y-auto"
                >
                    {presets.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">
                            No presets yet — add one on the right.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {presets.map((preset) => (
                                <div
                                    key={preset.id}
                                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3"
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onSetDefault(preset)}
                                            aria-pressed={preset.is_default}
                                            title={
                                                preset.is_default
                                                    ? 'Default preset (starts from home)'
                                                    : 'Make default'
                                            }
                                            className={
                                                'shrink-0 ' +
                                                (preset.is_default
                                                    ? 'text-[var(--accent)]'
                                                    : 'text-[var(--muted)] hover:text-[var(--ink)]')
                                            }
                                        >
                                            {preset.is_default ? (
                                                <StarIcon size={15} />
                                            ) : (
                                                <StarOutlineIcon size={15} />
                                            )}
                                        </button>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">
                                                {preset.name}
                                            </p>
                                            <p className="text-xs text-[var(--muted)]">
                                                {preset.focus_minutes} min focus
                                                · {preset.break_minutes} min
                                                break
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <PillButton
                                            primary
                                            onClick={() => timer.start(preset)}
                                            ariaLabel={`Start ${preset.name}`}
                                        >
                                            <PlayIcon size={14} />
                                        </PillButton>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onDestroyPreset(preset)
                                            }
                                            className="text-xs text-[var(--neg)] hover:underline"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </GlassCard>

                <GlassCard title="New preset">
                    <form onSubmit={onSubmitPreset} className="space-y-3">
                        <div>
                            <GlassLabel htmlFor="glass_preset_name">
                                Name
                            </GlassLabel>
                            <GlassInput
                                id="glass_preset_name"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder="Deep work"
                                required
                            />
                            <GlassError message={errors.name} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <GlassLabel htmlFor="glass_focus_minutes">
                                    Focus minutes
                                </GlassLabel>
                                <GlassInput
                                    id="glass_focus_minutes"
                                    type="number"
                                    min="1"
                                    max="180"
                                    value={data.focus_minutes}
                                    onChange={(e) =>
                                        setData('focus_minutes', e.target.value)
                                    }
                                    required
                                />
                                <GlassError message={errors.focus_minutes} />
                            </div>
                            <div>
                                <GlassLabel htmlFor="glass_break_minutes">
                                    Break minutes
                                </GlassLabel>
                                <GlassInput
                                    id="glass_break_minutes"
                                    type="number"
                                    min="0"
                                    max="60"
                                    value={data.break_minutes}
                                    onChange={(e) =>
                                        setData('break_minutes', e.target.value)
                                    }
                                    required
                                />
                                <GlassError message={errors.break_minutes} />
                            </div>
                        </div>
                        <GlassButton type="submit" disabled={processing}>
                            Add preset
                        </GlassButton>
                    </form>
                </GlassCard>
            </div>
        </div>
    );
}
