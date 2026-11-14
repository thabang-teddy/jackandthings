/**
 * The pure rules of a tracked workout: how a set compares to the last one,
 * what comes next in a routine, and how long to rest in between.
 *
 * Kept free of React, storage and the network for the same reason
 * pomodoroCycle.js is: this is the part worth pinning with tests, and it is
 * also the part the Kotlin client and the add-on have to agree with exactly.
 * If the three surfaces ever disagree about whether a set was a personal
 * record, this file is the reference.
 *
 * extension/src/lib/workoutProgress.js is its twin and
 * android/.../workout/WorkoutProgress.kt is the Kotlin port. Change one and
 * change all three, the way the pomodoroCycle.js trio already works.
 *
 * Every measure here is an integer in the unit the server stores - grams,
 * metres, seconds - so nothing in this file needs to know about kilograms.
 * Formatting for display is deliberately somewhere else.
 */

/** Mirrors App\Enums\ExerciseMetric on the server. */
export const METRIC_WEIGHT_REPS = 'weight_reps';
export const METRIC_REPS_ONLY = 'reps_only';
export const METRIC_DISTANCE_DURATION = 'distance_duration';
export const METRIC_DURATION = 'duration';

export const METRICS = [
    METRIC_WEIGHT_REPS,
    METRIC_REPS_ONLY,
    METRIC_DISTANCE_DURATION,
    METRIC_DURATION,
];

/** Used when a routine item names no rest of its own. */
export const DEFAULT_REST_SECONDS = 90;

/**
 * Which numbers a set of this exercise carries. Mirrors the tracks* methods on
 * App\Enums\ExerciseMetric, so a client draws exactly the inputs the server
 * will accept.
 */
export function fieldsFor(metric) {
    switch (metric) {
        case METRIC_WEIGHT_REPS:
            return {
                weight: true,
                reps: true,
                distance: false,
                duration: false,
            };
        case METRIC_REPS_ONLY:
            return {
                weight: false,
                reps: true,
                distance: false,
                duration: false,
            };
        case METRIC_DISTANCE_DURATION:
            return {
                weight: false,
                reps: false,
                distance: true,
                duration: true,
            };
        case METRIC_DURATION:
            return {
                weight: false,
                reps: false,
                distance: false,
                duration: true,
            };
        default:
            // An unknown metric asks for everything rather than nothing: a
            // client one version behind should still be able to log a set.
            return { weight: true, reps: true, distance: true, duration: true };
    }
}

/**
 * Estimated one-rep max in grams, by Epley: weight * (1 + reps/30).
 *
 * Null unless the set carries both a load and a rep count, because the formula
 * needs both. A single rep is returned as-is - it already *is* a one-rep max,
 * and the formula would inflate it by a thirtieth.
 *
 * This mirrors App\Services\WorkoutRecords::estimatedOneRepMax exactly. If the
 * two ever disagree, the client would flag a record the server does not.
 */
export function estimatedOneRepMax(weightGrams, reps) {
    const weight = toInteger(weightGrams);
    const count = toInteger(reps);

    if (weight === null || count === null || count < 1) {
        return null;
    }

    if (count === 1) {
        return weight;
    }

    return Math.round(weight * (1 + count / 30));
}

/**
 * Load moved by one set, in grams. Zero without both a weight and a rep count:
 * volume is a strength measure, and a 5km run has no business contributing to
 * it. Mirrors WorkoutSet::volumeGrams().
 */
export function volumeGrams(set) {
    const weight = toInteger(set?.weight_grams);
    const reps = toInteger(set?.reps);

    if (weight === null || reps === null) {
        return 0;
    }

    return weight * reps;
}

/**
 * The best of each measure across a list of sets. Warm-ups are excluded -
 * they are logged so a session reads honestly, but a warm-up is never
 * somebody's best. Every measure is null when nothing carried it, which is
 * not the same as zero.
 */
export function bestOf(sets) {
    const counting = (sets ?? []).filter((set) => !set?.is_warmup);

    const best = {
        one_rep_max_grams: null,
        weight_grams: null,
        reps: null,
        distance_metres: null,
        duration_seconds: null,
    };

    counting.forEach((set) => {
        best.one_rep_max_grams = higher(
            best.one_rep_max_grams,
            estimatedOneRepMax(set?.weight_grams, set?.reps),
        );
        best.weight_grams = higher(
            best.weight_grams,
            toInteger(set?.weight_grams),
        );
        best.reps = higher(best.reps, toInteger(set?.reps));
        best.distance_metres = higher(
            best.distance_metres,
            toInteger(set?.distance_metres),
        );
        best.duration_seconds = higher(
            best.duration_seconds,
            toInteger(set?.duration_seconds),
        );
    });

    return best;
}

/**
 * Whether a set beats a previous best in any measure it carries. A measure the
 * set does not carry is ignored rather than counted as a loss, and a first-ever
 * set is a record by definition.
 *
 * Mirrors App\Services\WorkoutRecords::isRecord. The server is still the
 * authority - its reply carries `is_record` - but a client needs the same
 * answer locally to celebrate a set before the round trip finishes.
 */
export function beatsPrevious(set, previousBest) {
    if (!set || set.is_warmup) {
        return false;
    }

    const candidate = bestOf([set]);
    const previous = previousBest ?? {};

    return Object.keys(candidate).some((measure) => {
        const mine = candidate[measure];
        if (mine === null) {
            return false;
        }

        const theirs = toInteger(previous[measure]);

        return theirs === null || mine > theirs;
    });
}

/**
 * How long to rest after a set, in seconds. The routine item's own figure wins;
 * failing that, DEFAULT_REST_SECONDS, so a routine built without rest times
 * still drives a usable timer rather than a zero-length one.
 */
export function restSecondsFor(item) {
    const rest = toInteger(item?.rest_seconds);

    return rest === null || rest === 0 ? DEFAULT_REST_SECONDS : rest;
}

/**
 * What to do next in a routine, given what has been logged so far.
 *
 * Walks the routine in order and returns the first item whose target set count
 * has not been met, with the set number within that exercise. Returns null once
 * every target is met, which is what the UI reads as "routine complete" - it
 * does not stop the user logging more.
 *
 * Warm-ups do not count towards a target: they are preparation, not the work
 * the routine asked for.
 */
export function nextSet(items, loggedSets) {
    const ordered = [...(items ?? [])].sort(
        (a, b) => (a?.position ?? 0) - (b?.position ?? 0),
    );
    const counted = (loggedSets ?? []).filter((set) => !set?.is_warmup);

    for (const item of ordered) {
        const done = counted.filter(
            (set) => set?.exercise_id === item?.exercise_id,
        ).length;
        const target = toInteger(item?.target_sets) ?? 1;

        if (done < target) {
            return {
                item,
                exercise_id: item?.exercise_id,
                setNumber: done + 1,
                targetSets: target,
                restSeconds: restSecondsFor(item),
            };
        }
    }

    return null;
}

/**
 * How far through a routine the workout is, for a progress indicator. Counts
 * target sets rather than exercises, so a routine of three exercises at four
 * sets each reads 12 rather than 3.
 */
export function routineProgress(items, loggedSets) {
    const ordered = items ?? [];
    const counted = (loggedSets ?? []).filter((set) => !set?.is_warmup);

    const target = ordered.reduce(
        (total, item) => total + (toInteger(item?.target_sets) ?? 1),
        0,
    );

    // Capped at the target so logging extra sets cannot report 14 of 12.
    const done = Math.min(counted.length, target);

    return { done, target, complete: target > 0 && done >= target };
}

/**
 * Integer or null. Anything that is not a finite number - undefined, null, an
 * empty string, NaN - becomes null, so "not measured" never arrives at a
 * comparison as a zero.
 */
function toInteger(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? Math.round(number) : null;
}

function higher(current, candidate) {
    if (candidate === null) {
        return current;
    }

    return current === null || candidate > current ? candidate : current;
}
