import GlassCard from '@/Components/Glass/GlassCard';
import PillButton from '@/Components/Glass/PillButton';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
} from '@/Components/Glass/GlassFormControls';
import { formatClock } from '@/Lib/formatClock';

export default function PomodoroGlassView({
    presets,
    timer,
    presetForm,
    onSubmitPreset,
    onDestroyPreset,
}) {
    const { data, setData, errors, processing } = presetForm;

    return (
        <div className="flex h-full min-h-0 flex-col gap-4">
            <GlassCard id="timer">
                {timer.preset ? (
                    <div className="flex flex-col items-center py-4 text-center">
                        <p className="text-xs uppercase tracking-widest text-white/50">
                            {timer.phase === 'focus' ? 'Focus' : 'Break'} ·{' '}
                            {timer.preset.name}
                        </p>
                        <p className="my-3 font-mono text-5xl font-bold tabular-nums">
                            {formatClock(timer.secondsLeft)}
                        </p>
                        <div className="flex gap-2">
                            {timer.running ? (
                                <PillButton onClick={timer.pause}>
                                    Pause
                                </PillButton>
                            ) : (
                                <PillButton primary onClick={timer.resume}>
                                    Resume
                                </PillButton>
                            )}
                            <PillButton onClick={timer.stop}>Stop</PillButton>
                        </div>
                    </div>
                ) : (
                    <p className="py-6 text-center text-sm text-white/50">
                        Pick a preset below to start a session.
                    </p>
                )}
            </GlassCard>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
                <GlassCard
                    id="presets"
                    title="Presets"
                    className="overflow-y-auto"
                >
                    {presets.length === 0 ? (
                        <p className="text-sm text-white/40">
                            No presets yet — add one on the right.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {presets.map((preset) => (
                                <div
                                    key={preset.id}
                                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                                >
                                    <div>
                                        <p className="text-sm font-semibold">
                                            {preset.name}
                                        </p>
                                        <p className="text-xs text-white/40">
                                            {preset.focus_minutes} min focus ·{' '}
                                            {preset.break_minutes} min break
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <PillButton
                                            primary
                                            onClick={() => timer.start(preset)}
                                        >
                                            Start
                                        </PillButton>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onDestroyPreset(preset)
                                            }
                                            className="text-xs text-rose-400 hover:underline"
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
