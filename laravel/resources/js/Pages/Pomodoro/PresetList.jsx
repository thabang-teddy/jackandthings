import GlassCard from '@/Components/Glass/GlassCard';
import PillButton from '@/Components/Glass/PillButton';
import { PlayIcon, StarIcon, StarOutlineIcon } from '@/Components/Glass/icons';
import { SOUND_LABELS } from '@/Lib/pomodoroSounds';

/**
 * The saved presets, with what each one actually does spelled out.
 *
 * Fourteen fields are too many to list, so the summary shows the three that
 * change how a session behaves - the durations, the auto-start choices and
 * whether sound or strict mode are on - and the rest is in the editor.
 */

function PresetSummary({ preset }) {
    const parts = [
        `${preset.focus_minutes} min focus`,
        preset.break_minutes > 0
            ? `${preset.break_minutes} min break`
            : 'no break',
    ];

    if (preset.long_break_minutes > 0) {
        parts.push(
            `${preset.long_break_minutes} min long every ${preset.cycles_before_long_break}`,
        );
    }

    return (
        <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold">
                {preset.name}
                {preset.tag && (
                    <span className="shrink-0 rounded-full bg-[var(--card-border)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
                        {preset.tag}
                    </span>
                )}
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
                {parts.join(' · ')}
            </p>
            <p className="truncate text-[10.5px] text-[var(--muted)] opacity-80">
                {preset.auto_start_breaks ? 'auto breaks' : 'manual breaks'}
                {' · '}
                {preset.auto_start_focus ? 'auto focus' : 'manual focus'}
                {preset.ambience !== 'none' &&
                    ` · ${SOUND_LABELS[preset.ambience] ?? preset.ambience}`}
                {preset.strict_mode && ' · strict'}
            </p>
        </div>
    );
}

export default function PresetList({
    presets,
    editingId,
    onStart,
    onEdit,
    onDestroy,
    onSetDefault,
}) {
    return (
        <GlassCard id="presets" title="Presets" className="overflow-y-auto">
            {presets.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                    No presets yet — add one on the right.
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    {presets.map((preset) => (
                        <div
                            key={preset.id}
                            className={
                                'flex items-center justify-between gap-3 rounded-2xl border bg-[var(--card-bg)] px-4 py-3 transition ' +
                                (preset.id === editingId
                                    ? 'border-[var(--accent)]'
                                    : 'border-[var(--card-border)]')
                            }
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
                                <PresetSummary preset={preset} />
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                                <PillButton
                                    primary
                                    onClick={() => onStart(preset)}
                                    ariaLabel={`Start ${preset.name}`}
                                >
                                    <PlayIcon size={14} />
                                </PillButton>
                                <button
                                    type="button"
                                    onClick={() => onEdit(preset)}
                                    className="text-xs text-[var(--muted)] hover:text-[var(--ink)] hover:underline"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDestroy(preset)}
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
    );
}
