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
    StopIcon,
} from '@/Components/Glass/icons';
import { formatClock } from '@/Lib/formatClock';
import { formatHoursMinutes } from '@/Lib/formatDuration';
import { useFullscreen } from '@/Lib/useFullscreen';

/**
 * The countdown and its controls — the whole of the Timer page.
 *
 * Lifted out of the old single Pomodoro page when the module was split into
 * four. It takes the timer rather than reaching for it, so the Timer page
 * owns the one subscription and this stays a presentational component.
 */

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

export default function TimerCard({
    presets,
    timer,
    todaySeconds,
    soundControl,
}) {
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
            title="Timer"
            className="flex-1"
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
                        : 'flex h-full flex-col items-center justify-center gap-5 py-6'
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
                    className={
                        'font-mono font-bold tabular-nums ' +
                        (isFullscreen ? 'text-8xl' : 'text-7xl')
                    }
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
