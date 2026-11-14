package com.jackandthings.workout

import com.jackandthings.model.WorkoutRoutineItem
import com.jackandthings.model.WorkoutSet

/** Mirrors App\Enums\ExerciseMetric and Lib/workoutProgress.js. */
enum class ExerciseMetric(val wireValue: String, val label: String) {
    WeightReps("weight_reps", "Weight and reps"),
    RepsOnly("reps_only", "Reps"),
    DistanceDuration("distance_duration", "Distance and time"),
    Duration("duration", "Time"),
    ;

    companion object {
        /**
         * An unknown value - a metric added by a newer server - is treated as
         * WeightReps rather than refused, so a client one version behind can
         * still log something.
         */
        fun fromWire(value: String?): ExerciseMetric =
            entries.firstOrNull { it.wireValue == value } ?: WeightReps
    }
}

/** Which measures a set of this exercise carries. */
data class SetFields(
    val weight: Boolean,
    val reps: Boolean,
    val distance: Boolean,
    val duration: Boolean,
)

/** The best of each measure across a group of sets; null means not measured. */
data class Best(
    val oneRepMaxGrams: Int? = null,
    val weightGrams: Int? = null,
    val reps: Int? = null,
    val distanceMetres: Int? = null,
    val durationSeconds: Int? = null,
)

/** What to do next in a routine. */
data class NextSet(
    val item: WorkoutRoutineItem,
    val exerciseId: String,
    val setNumber: Int,
    val targetSets: Int,
    val restSeconds: Int,
)

/** How far through a routine a workout is. */
data class RoutineProgress(
    val done: Int,
    val target: Int,
    val complete: Boolean,
)

/**
 * The pure rules of a tracked workout, with no coroutines, no Context and no
 * state of their own.
 *
 * This is the Kotlin half of a rule set three surfaces have to agree on
 * exactly - the other two are laravel/resources/js/Lib/workoutProgress.js and
 * extension/src/lib/workoutProgress.js, with App\Services\WorkoutRecords as
 * the server's authority. If they ever disagree about whether a set was a
 * personal record, those files are where to look.
 *
 * Everything here is an integer in the unit the server stores; kilograms exist
 * only at the point of display.
 */
object WorkoutProgress {

    /** Used when a routine item names no rest of its own. */
    const val DEFAULT_REST_SECONDS = 90

    fun fieldsFor(metric: String?): SetFields = when (ExerciseMetric.fromWire(metric)) {
        ExerciseMetric.WeightReps ->
            SetFields(weight = true, reps = true, distance = false, duration = false)
        ExerciseMetric.RepsOnly ->
            SetFields(weight = false, reps = true, distance = false, duration = false)
        ExerciseMetric.DistanceDuration ->
            SetFields(weight = false, reps = false, distance = true, duration = true)
        ExerciseMetric.Duration ->
            SetFields(weight = false, reps = false, distance = false, duration = true)
    }

    /**
     * Estimated one-rep max in grams, by Epley: weight * (1 + reps/30).
     *
     * Null unless the set carries both a load and a rep count, because the
     * formula needs both. A single rep is returned as-is - it already *is* a
     * one-rep max, and the formula would inflate it by a thirtieth.
     *
     * Mirrors WorkoutRecords::estimatedOneRepMax exactly. If the two ever
     * disagree, this client would celebrate a record the server does not
     * record.
     */
    fun estimatedOneRepMax(weightGrams: Int?, reps: Int?): Int? {
        if (weightGrams == null || reps == null || reps < 1) return null
        if (reps == 1) return weightGrams

        return Math.round(weightGrams * (1 + reps / 30.0)).toInt()
    }

    /**
     * Load moved by one set, in grams. Zero without both a weight and a rep
     * count: volume is a strength measure, and a 5km run has no business
     * contributing to it.
     */
    fun volumeGrams(set: WorkoutSet): Long {
        val weight = set.weightGrams ?: return 0
        val reps = set.reps ?: return 0

        return weight.toLong() * reps
    }

    /**
     * The best of each measure across a group of sets. Warm-ups are excluded:
     * they are logged so a session reads honestly, but a warm-up is never
     * somebody's best.
     */
    fun bestOf(sets: List<WorkoutSet>): Best {
        val counting = sets.filterNot { it.isWarmup }

        return Best(
            oneRepMaxGrams = counting.mapNotNull { estimatedOneRepMax(it.weightGrams, it.reps) }.maxOrNull(),
            weightGrams = counting.mapNotNull { it.weightGrams }.maxOrNull(),
            reps = counting.mapNotNull { it.reps }.maxOrNull(),
            distanceMetres = counting.mapNotNull { it.distanceMetres }.maxOrNull(),
            durationSeconds = counting.mapNotNull { it.durationSeconds }.maxOrNull(),
        )
    }

    /**
     * Whether a set beats a previous best in any measure it carries. A measure
     * the set does not carry is ignored rather than counted as a loss, and a
     * first-ever set is a record by definition.
     *
     * The server is still the authority - its reply carries `is_record` - but
     * the screen needs the same answer locally to flag a set before the round
     * trip finishes.
     */
    fun beatsPrevious(set: WorkoutSet, previous: Best?): Boolean {
        if (set.isWarmup) return false

        val candidate = bestOf(listOf(set))
        val before = previous ?: Best()

        val comparisons = listOf(
            candidate.oneRepMaxGrams to before.oneRepMaxGrams,
            candidate.weightGrams to before.weightGrams,
            candidate.reps to before.reps,
            candidate.distanceMetres to before.distanceMetres,
            candidate.durationSeconds to before.durationSeconds,
        )

        return comparisons.any { (mine, theirs) ->
            mine != null && (theirs == null || mine > theirs)
        }
    }

    /**
     * How long to rest after a set. The routine item's own figure wins; failing
     * that, DEFAULT_REST_SECONDS, so a routine built without rest times still
     * drives a usable timer rather than a zero-length one.
     */
    fun restSecondsFor(item: WorkoutRoutineItem?): Int {
        val rest = item?.restSeconds

        return if (rest == null || rest == 0) DEFAULT_REST_SECONDS else rest
    }

    /**
     * What to do next in a routine, given what has been logged so far.
     *
     * Walks the routine in order and returns the first item whose target set
     * count has not been met. Null once every target is met, which the UI
     * reads as "routine complete" - it does not stop the user logging more.
     *
     * Warm-ups do not count towards a target: they are preparation, not the
     * work the routine asked for.
     */
    fun nextSet(items: List<WorkoutRoutineItem>, loggedSets: List<WorkoutSet>): NextSet? {
        val counted = loggedSets.filterNot { it.isWarmup }

        items.sortedBy { it.position }.forEach { item ->
            val done = counted.count { it.exerciseId == item.exerciseId }
            val target = item.targetSets ?: 1

            if (done < target) {
                return NextSet(
                    item = item,
                    exerciseId = item.exerciseId,
                    setNumber = done + 1,
                    targetSets = target,
                    restSeconds = restSecondsFor(item),
                )
            }
        }

        return null
    }

    /**
     * How far through a routine the workout is. Counts target sets rather than
     * exercises, so three exercises at four sets each reads 12 rather than 3.
     */
    fun routineProgress(
        items: List<WorkoutRoutineItem>,
        loggedSets: List<WorkoutSet>,
    ): RoutineProgress {
        val target = items.sumOf { it.targetSets ?: 1 }
        // Capped at the target so logging extra sets cannot report 14 of 12.
        val done = minOf(loggedSets.count { !it.isWarmup }, target)

        return RoutineProgress(done = done, target = target, complete = target > 0 && done >= target)
    }
}
