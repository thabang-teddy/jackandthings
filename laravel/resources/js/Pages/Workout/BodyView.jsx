import { useMemo, useState } from 'react';
import { useForm } from '@inertiajs/react';
import GlassCard from '@/Components/Glass/GlassCard';
import Sparkline from '@/Components/Glass/Sparkline';
import StatPill from '@/Components/Glass/StatPill';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassSelect,
    GlassTextarea,
} from '@/Components/Glass/GlassFormControls';
import {
    cmToMillimetres,
    formatBodyFat,
    formatKg,
    formatTape,
    kgToGrams,
    percentToPermille,
} from '@/Lib/formatWorkout';

const SITE_LABELS = {
    chest: 'Chest',
    waist: 'Waist',
    hips: 'Hips',
    arm: 'Arm',
    thigh: 'Thigh',
    calf: 'Calf',
    neck: 'Neck',
};

function today() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Body weight, body fat, tape measurements and progress photos.
 *
 * Everything is typed in the units a person uses - kilograms, percent,
 * centimetres - and converted to the integers the server stores on the way
 * out, so nothing rounds twice.
 *
 * Photos load through an authorized route, never a direct file URL: see
 * App\Services\ProgressPhotoStorage.
 */
export default function WorkoutBodyView({
    metrics,
    photos,
    sites,
    maxPhotoKilobytes,
    onDeleteMetric,
    onDeletePhoto,
}) {
    const [editingDay, setEditingDay] = useState(null);

    const measurementForm = useForm({
        measured_on: today(),
        weight_kg: '',
        body_fat_percent: '',
        notes: '',
        measurements: {},
    });

    const photoForm = useForm({
        photo: null,
        taken_on: today(),
        caption: '',
        body_metric_id: '',
    });

    const latest = metrics[0] ?? null;

    // Oldest first, so the sparkline reads left to right in time.
    const weightTrend = useMemo(
        () =>
            [...metrics]
                .reverse()
                .map((metric) => metric.weight_grams)
                .filter((grams) => grams !== null && grams !== undefined),
        [metrics],
    );

    const startEdit = (metric) => {
        setEditingDay(metric.measured_on);
        measurementForm.setData({
            measured_on: metric.measured_on,
            weight_kg: metric.weight_grams
                ? String(metric.weight_grams / 1000)
                : '',
            body_fat_percent: metric.body_fat_permille
                ? String(metric.body_fat_permille / 10)
                : '',
            notes: metric.notes ?? '',
            measurements: Object.fromEntries(
                Object.entries(metric.measurements ?? {}).map(([site, mm]) => [
                    site,
                    String(mm / 10),
                ]),
            ),
        });
    };

    const submitMeasurements = (event) => {
        event.preventDefault();

        measurementForm.transform((payload) => ({
            measured_on: payload.measured_on,
            weight_grams: kgToGrams(payload.weight_kg),
            body_fat_permille: percentToPermille(payload.body_fat_percent),
            notes: payload.notes,
            measurements: Object.fromEntries(
                Object.entries(payload.measurements)
                    .filter(([, value]) => value !== '' && value !== null)
                    .map(([site, value]) => [site, cmToMillimetres(value)]),
            ),
        }));

        measurementForm.post(route('workouts.body.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setEditingDay(null);
                measurementForm.reset();
                measurementForm.setData('measured_on', today());
            },
        });
    };

    const submitPhoto = (event) => {
        event.preventDefault();

        photoForm.post(route('progress-photos.store'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => photoForm.reset(),
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
                <StatPill
                    label="Weight"
                    value={formatKg(latest?.weight_grams) ?? '—'}
                />
                <StatPill
                    label="Body fat"
                    value={formatBodyFat(latest?.body_fat_permille) ?? '—'}
                    dotColor="#5FCB9B"
                />
                <StatPill
                    label="Readings"
                    value={metrics.length}
                    dotColor="#D4537E"
                />
            </div>

            {weightTrend.length > 1 && (
                <GlassCard title="Weight over time">
                    <Sparkline values={weightTrend} color="#8B9DFF" area />
                </GlassCard>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                <GlassCard
                    title={
                        editingDay
                            ? `Editing ${editingDay}`
                            : "Log today's measurements"
                    }
                >
                    <form onSubmit={submitMeasurements} className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                                <GlassLabel htmlFor="measured_on">
                                    Date
                                </GlassLabel>
                                <GlassInput
                                    id="measured_on"
                                    type="date"
                                    max={today()}
                                    value={measurementForm.data.measured_on}
                                    onChange={(event) =>
                                        measurementForm.setData(
                                            'measured_on',
                                            event.target.value,
                                        )
                                    }
                                    required
                                />
                                <GlassError
                                    message={measurementForm.errors.measured_on}
                                />
                            </div>
                            <div>
                                <GlassLabel htmlFor="weight_kg">
                                    Weight (kg)
                                </GlassLabel>
                                <GlassInput
                                    id="weight_kg"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    inputMode="decimal"
                                    value={measurementForm.data.weight_kg}
                                    onChange={(event) =>
                                        measurementForm.setData(
                                            'weight_kg',
                                            event.target.value,
                                        )
                                    }
                                />
                                <GlassError
                                    message={
                                        measurementForm.errors.weight_grams
                                    }
                                />
                            </div>
                            <div>
                                <GlassLabel htmlFor="body_fat">
                                    Body fat (%)
                                </GlassLabel>
                                <GlassInput
                                    id="body_fat"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    inputMode="decimal"
                                    value={
                                        measurementForm.data.body_fat_percent
                                    }
                                    onChange={(event) =>
                                        measurementForm.setData(
                                            'body_fat_percent',
                                            event.target.value,
                                        )
                                    }
                                />
                                <GlassError
                                    message={
                                        measurementForm.errors.body_fat_permille
                                    }
                                />
                            </div>
                        </div>

                        <div>
                            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                                Tape (cm)
                            </p>
                            <div className="grid gap-2 sm:grid-cols-4">
                                {sites.map((site) => (
                                    <div key={site}>
                                        <GlassLabel htmlFor={`site_${site}`}>
                                            {SITE_LABELS[site] ?? site}
                                        </GlassLabel>
                                        <GlassInput
                                            id={`site_${site}`}
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            inputMode="decimal"
                                            value={
                                                measurementForm.data
                                                    .measurements[site] ?? ''
                                            }
                                            onChange={(event) =>
                                                measurementForm.setData(
                                                    'measurements',
                                                    {
                                                        ...measurementForm.data
                                                            .measurements,
                                                        [site]: event.target
                                                            .value,
                                                    },
                                                )
                                            }
                                        />
                                        <GlassError
                                            message={
                                                measurementForm.errors[
                                                    `measurements.${site}`
                                                ]
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <GlassLabel htmlFor="body_notes">Notes</GlassLabel>
                            <GlassTextarea
                                id="body_notes"
                                rows={2}
                                value={measurementForm.data.notes}
                                onChange={(event) =>
                                    measurementForm.setData(
                                        'notes',
                                        event.target.value,
                                    )
                                }
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <GlassButton
                                type="submit"
                                disabled={measurementForm.processing}
                            >
                                Save
                            </GlassButton>
                            <p className="text-xs text-[var(--muted)]">
                                One reading a day — saving again replaces that
                                day.
                            </p>
                        </div>
                    </form>
                </GlassCard>

                <GlassCard title="Add a progress photo">
                    <form onSubmit={submitPhoto} className="space-y-3">
                        <div>
                            <GlassLabel htmlFor="photo">Image</GlassLabel>
                            <input
                                id="photo"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/heic"
                                onChange={(event) =>
                                    photoForm.setData(
                                        'photo',
                                        event.target.files?.[0] ?? null,
                                    )
                                }
                                className="block w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--ink)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1 file:text-xs file:font-bold file:uppercase file:text-[var(--accent-ink)]"
                                required
                            />
                            <GlassError message={photoForm.errors.photo} />
                            <p className="mt-1 text-xs text-[var(--muted)]">
                                JPEG, PNG, WebP or HEIC, up to{' '}
                                {Math.round(maxPhotoKilobytes / 1024)} MB.
                                Photos are private to your account and are never
                                given a public link.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <GlassLabel htmlFor="taken_on">
                                    Taken
                                </GlassLabel>
                                <GlassInput
                                    id="taken_on"
                                    type="date"
                                    max={today()}
                                    value={photoForm.data.taken_on}
                                    onChange={(event) =>
                                        photoForm.setData(
                                            'taken_on',
                                            event.target.value,
                                        )
                                    }
                                    required
                                />
                                <GlassError
                                    message={photoForm.errors.taken_on}
                                />
                            </div>
                            <div>
                                <GlassLabel htmlFor="photo_metric">
                                    Pin to a reading
                                </GlassLabel>
                                <GlassSelect
                                    id="photo_metric"
                                    value={photoForm.data.body_metric_id}
                                    onChange={(event) =>
                                        photoForm.setData(
                                            'body_metric_id',
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="">None</option>
                                    {metrics.map((metric) => (
                                        <option
                                            key={metric.id}
                                            value={metric.id}
                                        >
                                            {metric.measured_on}
                                        </option>
                                    ))}
                                </GlassSelect>
                            </div>
                        </div>

                        <div>
                            <GlassLabel htmlFor="caption">Caption</GlassLabel>
                            <GlassInput
                                id="caption"
                                value={photoForm.data.caption}
                                onChange={(event) =>
                                    photoForm.setData(
                                        'caption',
                                        event.target.value,
                                    )
                                }
                                placeholder="Week 6, front"
                            />
                            <GlassError message={photoForm.errors.caption} />
                        </div>

                        <GlassButton
                            type="submit"
                            disabled={photoForm.processing}
                        >
                            Upload
                        </GlassButton>
                    </form>
                </GlassCard>
            </div>

            <GlassCard title={`Photos (${photos.length})`}>
                {photos.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        No photos yet. They stay private to your account.
                    </p>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {photos.map((photo) => (
                            <figure
                                key={photo.id}
                                className="overflow-hidden rounded-xl border border-[var(--card-border)]"
                            >
                                <img
                                    src={photo.url}
                                    alt={
                                        photo.caption ??
                                        `Progress photo, ${photo.taken_on}`
                                    }
                                    loading="lazy"
                                    className="aspect-square w-full object-cover"
                                />
                                <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5">
                                    <span className="min-w-0 truncate text-xs text-[var(--muted)]">
                                        {photo.caption || photo.taken_on}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => onDeletePhoto(photo)}
                                        className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--neg)]"
                                    >
                                        Delete
                                    </button>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                )}
            </GlassCard>

            <GlassCard title={`Readings (${metrics.length})`}>
                {metrics.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                        Nothing logged yet.
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {metrics.map((metric) => (
                            <div
                                key={metric.id}
                                className="flex items-start justify-between gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[var(--ink)]">
                                        {metric.measured_on}
                                    </p>
                                    <p className="truncate text-xs text-[var(--muted)]">
                                        {[
                                            formatKg(metric.weight_grams),
                                            formatBodyFat(
                                                metric.body_fat_permille,
                                            ),
                                            ...Object.entries(
                                                metric.measurements ?? {},
                                            ).map(
                                                ([site, mm]) =>
                                                    `${SITE_LABELS[site] ?? site} ${formatTape(mm)}`,
                                            ),
                                        ]
                                            .filter(Boolean)
                                            .join(' · ') || 'No figures'}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-3 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => startEdit(metric)}
                                        className="text-[#8BB4FF] hover:underline"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDeleteMetric(metric)}
                                        className="text-[var(--muted)] hover:text-[var(--neg)]"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
