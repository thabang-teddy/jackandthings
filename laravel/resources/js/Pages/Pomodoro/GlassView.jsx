import { useRef } from 'react';
import GlassCard from '@/Components/Glass/GlassCard';
import PillButton from '@/Components/Glass/PillButton';
import { GlassSelect } from '@/Components/Glass/GlassFormControls';
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
import { formatHoursMinutes } from '@/Lib/formatDuration';
import { useFullscreen } from '@/Lib/useFullscreen';
import { SOUND_LABELS } from '@/Lib/pomodoroSounds';
import AnalyticsCard from './AnalyticsCard';
import PresetForm from './PresetForm';
import SessionsCard from './SessionsCard';

/**
 * Shows which focus run of the set is on the clock - "3 of 4" - so the long
 * break is never a surprise. A preset that never takes a long break has no
 * set to be in, so the dots are hidden rather than showing one lonely dot.
 */
function CycleDots({ cycle, phase }) {
    if (cycle.length <= 1) {
        return null;
    }

    return (
        <div
            className="flex items-center gap-1.5"
            aria-label={`Focus run ${cycle.index} of ${cycle.length}`}
        >
            {Array.from({ length: cycle.length }, (_, index) => {
                const position = index + 1;
                const done = position < cycle.index;
                const current = position === cycle.index;

                return (
                    <span
                        key={position}
                        aria-hidden="true"
                        className={
                            'h-1.5 rounded-full transition-all ' +
                            (current
                                ? 'w-5 bg-[var(--accent)]'
                                : done
                                  ? 'w-1.5 bg-[var(--accent)] opacity-60'
                                  : 'w-1.5 bg-[var(--card-border)]')
                        }
                    />
                );
            })}
            <span className="ml-1 text-[10px] tabular-nums text-[var(--muted)]">
                {phase === 'long_break'
                    ? 'set complete'
                    : `${cycle.index}/${cycle.length}`}
            </span>
        </div>
    );
}

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

function PomodoroOverview({ presets, timer, todaySeconds, soundControl }) {
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
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={soundControl.toggle}
                        disabled={!soundControl.supported}
                        aria-pressed={soundControl.enabled}
                        title={
                            soundControl.supported
                                ? soundControl.enabled
                                    ? 'Mute Pomodoro sounds'
                                    : 'Unmute Pomodoro sounds'
                                : 'This browser cannot play the generated sounds'
                        }
                        className={
                            'text-[11px] font-bold transition ' +
                            (soundControl.enabled
                                ? 'text-[var(--accent)]'
                                : 'text-[var(--muted)] hover:text-[var(--ink)]') +
                            (soundControl.supported ? '' : ' opacity-40')
                        }
                    >
                        {soundControl.enabled ? 'Sound on' : 'Sound off'}
                    </button>
                    <button
                        type="button"
                        onClick={toggle}
                        title={
                            isFullscreen ? 'Exit full screen' : 'Full screen'
                        }
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
                </div>
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
                    aria-label="Preset"
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
                        ? `${timer.phaseLabel} · ${timer.phaseMessage} · ${timer.preset.name}`
                        : 'Pick a preset to start a session'}
                </p>

                <p
                    className="my-1 font-mono text-5xl font-bold tabular-nums"
                    // The countdown changes every second, so it is announced
                    // politely rather than assertively; a screen reader
                    // interrupting itself once a second is unusable.
                    role="timer"
                    aria-live="off"
                >
                    {formatClock(timer.secondsLeft)}
                </p>

                {timer.preset && (
                    <CycleDots cycle={timer.cycle} phase={timer.phase} />
                )}

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

                <p className="text-[11px] text-[var(--muted)]">
                    {formatHoursMinutes(todaySeconds)} focused today
                </p>

                {/* Focus only: strict mode is not engaged during a break, so
                    saying it is would be a claim the page is not backing. */}
                {timer.strict && timer.running && !timer.onBreak && (
                    <p className="max-w-sm text-center text-[11px] leading-snug text-[var(--muted)]">
                        Strict mode: the screen stays awake and leaving this
                        page will ask first.
                        {timer.leftPageDuringFocus &&
                            ' You switched away during this run.'}
                    </p>
                )}
            </div>
        </GlassCard>
    );
}

export default function PomodoroGlassView({
    presets,
    analytics,
    recentSessions,
    tags,
    timer,
    presetForm,
    editing,
    soundControl,
    onSubmitPreset,
    onCancelEdit,
    onEditPreset,
    onDestroyPreset,
    onDestroySession,
    onSetDefault,
    onPreviewAlarm,
}) {
    return (
        <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-2">
                <PomodoroOverview
                    presets={presets}
                    timer={timer}
                    todaySeconds={analytics.today.focus_seconds}
                    soundControl={soundControl}
                />
                <AnalyticsCard analytics={analytics} />
            </div>

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
                                        <PresetSummary preset={preset} />
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
                                            onClick={() => onEditPreset(preset)}
                                            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] hover:underline"
                                        >
                                            Edit
                                        </button>
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

                <PresetForm
                    form={presetForm}
                    tags={tags}
                    editing={editing}
                    onSubmit={onSubmitPreset}
                    onCancelEdit={onCancelEdit}
                    onPreviewAlarm={onPreviewAlarm}
                />
            </div>

            <SessionsCard
                sessions={recentSessions}
                onDelete={onDestroySession}
            />
        </div>
    );
}
