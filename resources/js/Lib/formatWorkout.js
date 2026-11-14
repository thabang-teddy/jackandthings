/**
 * Display formatting for the integers the server stores.
 *
 * Kept apart from workoutProgress.js on purpose: the rules in that file have to
 * match the Kotlin and add-on copies exactly and are tested as pure arithmetic,
 * while everything here is about how a number reads to a person. Mixing the two
 * would mean a locale change could break a personal-record comparison.
 *
 * The project is fixed metric - kilograms and kilometres - the same call it
 * makes with ZAR in Budget. Nothing here converts to pounds or miles.
 */

/**
 * Grams as kilograms. Trailing zeroes are dropped, so 60000 reads "60 kg" and
 * 62500 reads "62.5 kg" rather than "60.00 kg".
 */
export function formatKg(grams) {
    if (grams === null || grams === undefined || grams === '') {
        return null;
    }

    const kg = Number(grams) / 1000;

    if (!Number.isFinite(kg)) {
        return null;
    }

    return `${trim(kg, 2)} kg`;
}

/**
 * Metres as metres under a kilometre and kilometres above it: a 400 m interval
 * should not read "0.4 km".
 */
export function formatDistance(metres) {
    if (metres === null || metres === undefined || metres === '') {
        return null;
    }

    const value = Number(metres);

    if (!Number.isFinite(value)) {
        return null;
    }

    if (value < 1000) {
        return `${Math.round(value)} m`;
    }

    return `${trim(value / 1000, 2)} km`;
}

/**
 * Seconds as a clock for anything under an hour and h/m above it. A rest timer
 * and a plank both want "1:30"; a two-hour ride does not want "120:00".
 */
export function formatSeconds(seconds) {
    if (seconds === null || seconds === undefined || seconds === '') {
        return null;
    }

    const total = Math.max(0, Math.round(Number(seconds)));

    if (!Number.isFinite(total)) {
        return null;
    }

    if (total >= 3600) {
        const hours = Math.floor(total / 3600);
        const minutes = Math.round((total % 3600) / 60);

        return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
    }

    const minutes = Math.floor(total / 60);
    const rest = total % 60;

    return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Permille as a percentage: 175 reads "17.5%". */
export function formatBodyFat(permille) {
    if (permille === null || permille === undefined || permille === '') {
        return null;
    }

    const value = Number(permille);

    return Number.isFinite(value) ? `${trim(value / 10, 1)}%` : null;
}

/** Millimetres as centimetres, which is how a tape is read. */
export function formatTape(millimetres) {
    if (
        millimetres === null ||
        millimetres === undefined ||
        millimetres === ''
    ) {
        return null;
    }

    const value = Number(millimetres);

    return Number.isFinite(value) ? `${trim(value / 10, 1)} cm` : null;
}

/**
 * One set as a single line - "80 kg × 5", "5 km in 24:30", "1:00" - picking
 * whichever measures the set actually carries. Returns a dash rather than an
 * empty string when it carries none, so a table cell never collapses.
 */
export function formatSet(set) {
    if (!set) {
        return '—';
    }

    const weight = formatKg(set.weight_grams);
    const distance = formatDistance(set.distance_metres);
    const duration = formatSeconds(set.duration_seconds);
    const reps = set.reps ?? null;

    const parts = [];

    if (weight && reps) {
        parts.push(`${weight} × ${reps}`);
    } else if (weight) {
        parts.push(weight);
    } else if (reps) {
        parts.push(`${reps} rep${reps === 1 ? '' : 's'}`);
    }

    if (distance && duration) {
        parts.push(`${distance} in ${duration}`);
    } else if (distance) {
        parts.push(distance);
    } else if (duration) {
        parts.push(duration);
    }

    if (set.rpe) {
        parts.push(`RPE ${set.rpe}`);
    }

    return parts.length > 0 ? parts.join(' · ') : '—';
}

/** Total volume for a card header: tonnes once it stops reading sensibly in kg. */
export function formatVolume(grams) {
    const value = Number(grams ?? 0);

    if (!Number.isFinite(value) || value === 0) {
        return '0 kg';
    }

    if (value >= 1_000_000) {
        return `${trim(value / 1_000_000, 1)} t`;
    }

    return `${trim(value / 1000, 0)} kg`;
}

/** Kilograms back into grams, for a form sending what the server stores. */
export function kgToGrams(kg) {
    if (kg === null || kg === undefined || kg === '') {
        return null;
    }

    const value = Number(kg);

    return Number.isFinite(value) ? Math.round(value * 1000) : null;
}

/** Centimetres back into millimetres. */
export function cmToMillimetres(cm) {
    if (cm === null || cm === undefined || cm === '') {
        return null;
    }

    const value = Number(cm);

    return Number.isFinite(value) ? Math.round(value * 10) : null;
}

/** A percentage back into permille. */
export function percentToPermille(percent) {
    if (percent === null || percent === undefined || percent === '') {
        return null;
    }

    const value = Number(percent);

    return Number.isFinite(value) ? Math.round(value * 10) : null;
}

/** Grams back into kilograms, for prefilling a form from stored data. */
export function gramsToKg(grams) {
    if (grams === null || grams === undefined || grams === '') {
        return '';
    }

    const value = Number(grams);

    return Number.isFinite(value) ? String(trim(value / 1000, 2)) : '';
}

/** Millimetres back into centimetres, for prefilling a form. */
export function millimetresToCm(millimetres) {
    if (
        millimetres === null ||
        millimetres === undefined ||
        millimetres === ''
    ) {
        return '';
    }

    const value = Number(millimetres);

    return Number.isFinite(value) ? String(trim(value / 10, 1)) : '';
}

/** Permille back into a percentage, for prefilling a form. */
export function permilleToPercent(permille) {
    if (permille === null || permille === undefined || permille === '') {
        return '';
    }

    const value = Number(permille);

    return Number.isFinite(value) ? String(trim(value / 10, 1)) : '';
}

/**
 * Rounds to at most `places` decimals and drops trailing zeroes, so a whole
 * number never carries a pointless ".00".
 */
function trim(value, places) {
    return Number(value.toFixed(places));
}
