import GlassCard from '@/Components/Glass/GlassCard';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassSelect,
    GlassTextarea,
} from '@/Components/Glass/GlassFormControls';
import { SOUND_LABELS, SOUND_OPTIONS } from '@/Lib/pomodoroSounds';

/**
 * The preset editor. Fourteen fields is a lot for one card, so it is grouped
 * the way the issue frames them - timings, auto-start, tag, sound, strict
 * mode - rather than as one flat column of inputs.
 */

function Field({ id, label, error, children, hint }) {
    return (
        <div>
            <GlassLabel htmlFor={id}>{label}</GlassLabel>
            {children}
            {hint && (
                <p className="mt-1 text-[10.5px] leading-snug text-[var(--muted)]">
                    {hint}
                </p>
            )}
            <GlassError message={error} />
        </div>
    );
}

function Toggle({ id, label, hint, checked, onChange }) {
    return (
        <label
            htmlFor={id}
            className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[var(--card-border)] px-3 py-2.5"
        >
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--card-border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span className="min-w-0">
                <span className="block text-xs font-semibold text-[var(--ink)]">
                    {label}
                </span>
                <span className="block text-[10.5px] leading-snug text-[var(--muted)]">
                    {hint}
                </span>
            </span>
        </label>
    );
}

function SoundSelect({ id, label, kind, value, onChange, error, hint }) {
    return (
        <Field id={id} label={label} error={error} hint={hint}>
            <GlassSelect
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                {SOUND_OPTIONS[kind].map((option) => (
                    <option key={option} value={option}>
                        {SOUND_LABELS[option] ?? option}
                    </option>
                ))}
            </GlassSelect>
        </Field>
    );
}

export default function PresetForm({
    form,
    tags,
    editing,
    onSubmit,
    onCancelEdit,
    onPreviewAlarm,
}) {
    const { data, setData, errors, processing } = form;

    return (
        <GlassCard
            title={editing ? `Editing “${editing.name}”` : 'New preset'}
            action={
                editing && (
                    <button
                        type="button"
                        onClick={onCancelEdit}
                        className="text-[11px] text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                        Cancel
                    </button>
                )
            }
            className="overflow-y-auto"
        >
            <form onSubmit={onSubmit} className="space-y-4">
                <Field id="preset_name" label="Name" error={errors.name}>
                    <GlassInput
                        id="preset_name"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        placeholder="Deep work"
                        required
                    />
                </Field>

                <div>
                    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                        Timings
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <Field
                            id="focus_minutes"
                            label="Focus min"
                            error={errors.focus_minutes}
                        >
                            <GlassInput
                                id="focus_minutes"
                                type="number"
                                min="1"
                                max="180"
                                value={data.focus_minutes}
                                onChange={(e) =>
                                    setData('focus_minutes', e.target.value)
                                }
                                required
                            />
                        </Field>
                        <Field
                            id="break_minutes"
                            label="Short break min"
                            error={errors.break_minutes}
                        >
                            <GlassInput
                                id="break_minutes"
                                type="number"
                                min="0"
                                max="60"
                                value={data.break_minutes}
                                onChange={(e) =>
                                    setData('break_minutes', e.target.value)
                                }
                                required
                            />
                        </Field>
                        <Field
                            id="long_break_minutes"
                            label="Long break min"
                            error={errors.long_break_minutes}
                            hint="0 to never take one."
                        >
                            <GlassInput
                                id="long_break_minutes"
                                type="number"
                                min="0"
                                max="120"
                                value={data.long_break_minutes}
                                onChange={(e) =>
                                    setData(
                                        'long_break_minutes',
                                        e.target.value,
                                    )
                                }
                                required
                            />
                        </Field>
                        <Field
                            id="cycles_before_long_break"
                            label="Focus runs per long break"
                            error={errors.cycles_before_long_break}
                            hint="Classic Pomodoro is 4."
                        >
                            <GlassInput
                                id="cycles_before_long_break"
                                type="number"
                                min="1"
                                max="12"
                                value={data.cycles_before_long_break}
                                onChange={(e) =>
                                    setData(
                                        'cycles_before_long_break',
                                        e.target.value,
                                    )
                                }
                                required
                            />
                        </Field>
                    </div>
                </div>

                <div>
                    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                        Auto-start
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                        <Toggle
                            id="auto_start_breaks"
                            label="Start breaks automatically"
                            hint="A break begins the moment focus ends."
                            checked={data.auto_start_breaks}
                            onChange={(value) =>
                                setData('auto_start_breaks', value)
                            }
                        />
                        <Toggle
                            id="auto_start_focus"
                            label="Start the next focus run automatically"
                            hint="Off means a break ends on the clock and waits for you."
                            checked={data.auto_start_focus}
                            onChange={(value) =>
                                setData('auto_start_focus', value)
                            }
                        />
                    </div>
                </div>

                <Field
                    id="preset_tag"
                    label="Tag"
                    error={errors.tag}
                    hint="Labels every interval this preset runs, so the analytics can show where the time went."
                >
                    <GlassInput
                        id="preset_tag"
                        value={data.tag}
                        onChange={(e) => setData('tag', e.target.value)}
                        placeholder="Coding"
                        list="pomodoro_tag_options"
                        maxLength={40}
                    />
                    <datalist id="pomodoro_tag_options">
                        {tags.map((tag) => (
                            <option key={tag} value={tag} />
                        ))}
                    </datalist>
                </Field>

                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                            Sound
                        </p>
                        <button
                            type="button"
                            onClick={() => onPreviewAlarm(data.alarm_sound)}
                            className="text-[11px] text-[var(--accent)] hover:underline"
                        >
                            Preview alarm
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <SoundSelect
                            id="alarm_sound"
                            label="End-of-interval alarm"
                            kind="alarm"
                            value={data.alarm_sound}
                            onChange={(value) => setData('alarm_sound', value)}
                            error={errors.alarm_sound}
                        />
                        <SoundSelect
                            id="ticking_sound"
                            label="Ticking while focusing"
                            kind="ticking"
                            value={data.ticking_sound}
                            onChange={(value) =>
                                setData('ticking_sound', value)
                            }
                            error={errors.ticking_sound}
                        />
                        <SoundSelect
                            id="ambience"
                            label="Background sound"
                            kind="ambience"
                            value={data.ambience}
                            onChange={(value) => setData('ambience', value)}
                            error={errors.ambience}
                            hint="Generated in the browser, not streamed — nothing is downloaded."
                        />
                    </div>
                </div>

                <div>
                    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                        Strict mode
                    </p>
                    <Toggle
                        id="strict_mode"
                        label="Guard the focus run"
                        hint="On the web: keeps the screen awake and warns before you close the tab. The browser add-on blocks the sites below; Android silences notifications. A web page cannot do either of those itself."
                        checked={data.strict_mode}
                        onChange={(value) => setData('strict_mode', value)}
                    />

                    {data.strict_mode && (
                        <div className="mt-3">
                            <Field
                                id="blocked_sites"
                                label="Sites to block (add-on only)"
                                error={
                                    errors.blocked_sites ??
                                    errors['blocked_sites.0']
                                }
                                hint="One hostname per line, e.g. news.ycombinator.com or *.reddit.com."
                            >
                                <GlassTextarea
                                    id="blocked_sites"
                                    rows={3}
                                    value={data.blocked_sites}
                                    onChange={(e) =>
                                        setData('blocked_sites', e.target.value)
                                    }
                                    placeholder={
                                        'news.ycombinator.com\n*.reddit.com'
                                    }
                                />
                            </Field>
                        </div>
                    )}
                </div>

                <GlassButton type="submit" disabled={processing}>
                    {editing ? 'Save changes' : 'Add preset'}
                </GlassButton>
            </form>
        </GlassCard>
    );
}
