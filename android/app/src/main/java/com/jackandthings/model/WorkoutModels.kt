package com.jackandthings.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire models for the fitness tracking the server gained in issue #4 - the
 * exercise library, routines, sessions, sets, body metrics, progress photos
 * and the stats payload.
 *
 * Kept apart from Models.kt only because that file was already three hundred
 * lines; the conventions are identical. Field names are spelled out with
 * @SerialName rather than relying on a naming strategy, so a rename on either
 * side fails here instead of silently arriving as null, and every optional
 * field carries a default so an older client still parses a newer reply.
 *
 * Every measure is an integer in the unit the server stores - grams, metres,
 * seconds, permille, millimetres. Nothing here is a float, the same call
 * Budget makes with cents, and kilograms exist only at the point of display.
 */

/**
 * An exercise from the library.
 *
 * `isCustom` is what the server sends in place of an owner id: a client only
 * needs to know whether it may offer an edit button, not who owns the row. A
 * catalog exercise is readable by everybody and editable by nobody.
 *
 * There is no image or video field, and there will not be one: "form
 * demonstrations" are `instructions` plus `cues`, for the same reason the
 * Pomodoro sounds are synthesised rather than sampled.
 */
@Serializable
data class Exercise(
    val id: String,
    val name: String,
    val slug: String = "",
    val category: String,
    @SerialName("category_label") val categoryLabel: String = "",
    val metric: String,
    @SerialName("metric_label") val metricLabel: String = "",
    @SerialName("primary_muscle") val primaryMuscle: String? = null,
    val equipment: String? = null,
    val instructions: String? = null,
    val cues: List<String> = emptyList(),
    @SerialName("is_custom") val isCustom: Boolean = false,
)

/** A user's own exercise on its way to the server, before it has an id. */
@Serializable
data class ExerciseDraft(
    val name: String,
    val category: String,
    val metric: String,
    @SerialName("primary_muscle") val primaryMuscle: String? = null,
    val equipment: String? = null,
    val instructions: String? = null,
    val cues: List<String> = emptyList(),
)

@Serializable
data class WorkoutRoutine(
    val id: String,
    val name: String,
    val notes: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    val items: List<WorkoutRoutineItem> = emptyList(),
)

/**
 * One exercise's slot in a routine. Every target is nullable: which ones mean
 * anything depends on the exercise's metric, and null is "not set" rather
 * than zero.
 */
@Serializable
data class WorkoutRoutineItem(
    val id: String = "",
    @SerialName("exercise_id") val exerciseId: String,
    @SerialName("exercise_name") val exerciseName: String? = null,
    val category: String? = null,
    val metric: String? = null,
    val position: Int = 0,
    @SerialName("target_sets") val targetSets: Int? = null,
    @SerialName("target_reps") val targetReps: Int? = null,
    @SerialName("target_weight_grams") val targetWeightGrams: Int? = null,
    @SerialName("target_distance_metres") val targetDistanceMetres: Int? = null,
    @SerialName("target_duration_seconds") val targetDurationSeconds: Int? = null,
    @SerialName("rest_seconds") val restSeconds: Int? = null,
)

/**
 * A routine on its way to the server, sent whole rather than field by field -
 * the same call PomodoroPresetDraft makes, and for the same reason: threading
 * a dozen positional arguments through the switching, offline and outbox
 * layers is how a field goes missing.
 */
@Serializable
data class WorkoutRoutineDraft(
    val name: String,
    val notes: String? = null,
    val items: List<WorkoutRoutineItemDraft> = emptyList(),
)

/** `position` is deliberately absent: the server assigns it from list order. */
@Serializable
data class WorkoutRoutineItemDraft(
    @SerialName("exercise_id") val exerciseId: String,
    @SerialName("target_sets") val targetSets: Int? = null,
    @SerialName("target_reps") val targetReps: Int? = null,
    @SerialName("target_weight_grams") val targetWeightGrams: Int? = null,
    @SerialName("target_distance_metres") val targetDistanceMetres: Int? = null,
    @SerialName("target_duration_seconds") val targetDurationSeconds: Int? = null,
    @SerialName("rest_seconds") val restSeconds: Int? = null,
)

/**
 * One workout. Open while it runs; `finishedAt` is set when it ends.
 *
 * Unlike a Pomodoro interval, which is only ever written once it has already
 * ended, this row exists while the workout is still happening - the sets have
 * to attach to something. The rest countdown between sets is still never
 * persisted anywhere.
 */
@Serializable
data class WorkoutSession(
    val id: String,
    @SerialName("workout_routine_id") val workoutRoutineId: String? = null,
    @SerialName("routine_name") val routineName: String? = null,
    @SerialName("started_at") val startedAt: String? = null,
    @SerialName("finished_at") val finishedAt: String? = null,
    @SerialName("is_open") val isOpen: Boolean = false,
    val notes: String? = null,
    @SerialName("duration_seconds") val durationSeconds: Int? = null,
    @SerialName("set_count") val setCount: Int = 0,
    @SerialName("volume_grams") val volumeGrams: Long = 0,
    val sets: List<WorkoutSet> = emptyList(),
)

/** A session on its way to the server, before it has an id. */
@Serializable
data class WorkoutSessionDraft(
    @SerialName("workout_routine_id") val workoutRoutineId: String? = null,
    @SerialName("started_at") val startedAt: String? = null,
    val notes: String? = null,
)

/** A single set. */
@Serializable
data class WorkoutSet(
    val id: String,
    @SerialName("workout_session_id") val workoutSessionId: String = "",
    @SerialName("exercise_id") val exerciseId: String,
    @SerialName("exercise_name") val exerciseName: String? = null,
    val metric: String? = null,
    val position: Int = 0,
    @SerialName("is_warmup") val isWarmup: Boolean = false,
    val reps: Int? = null,
    @SerialName("weight_grams") val weightGrams: Int? = null,
    @SerialName("distance_metres") val distanceMetres: Int? = null,
    @SerialName("duration_seconds") val durationSeconds: Int? = null,
    val rpe: Int? = null,
    @SerialName("volume_grams") val volumeGrams: Long = 0,
    @SerialName("completed_at") val completedAt: String? = null,
)

/** A set on its way to the server, before it has an id or a position. */
@Serializable
data class WorkoutSetDraft(
    @SerialName("exercise_id") val exerciseId: String,
    @SerialName("is_warmup") val isWarmup: Boolean = false,
    val reps: Int? = null,
    @SerialName("weight_grams") val weightGrams: Int? = null,
    @SerialName("distance_metres") val distanceMetres: Int? = null,
    @SerialName("duration_seconds") val durationSeconds: Int? = null,
    val rpe: Int? = null,
)

/**
 * A day's body figures. Weight is grams and body fat permille, so 17.5%
 * arrives as 175 and nothing is lost to rounding; tape measurements are
 * millimetres, keyed by site.
 */
@Serializable
data class BodyMetric(
    val id: String,
    @SerialName("measured_on") val measuredOn: String,
    @SerialName("weight_grams") val weightGrams: Int? = null,
    @SerialName("body_fat_permille") val bodyFatPermille: Int? = null,
    val measurements: Map<String, Int> = emptyMap(),
    val notes: String? = null,
    val photos: List<ProgressPhoto> = emptyList(),
)

@Serializable
data class BodyMetricDraft(
    @SerialName("measured_on") val measuredOn: String,
    @SerialName("weight_grams") val weightGrams: Int? = null,
    @SerialName("body_fat_permille") val bodyFatPermille: Int? = null,
    val measurements: Map<String, Int> = emptyMap(),
    val notes: String? = null,
)

/**
 * A progress photo's record.
 *
 * `url` is an authorized endpoint, not a file path: the server checks the
 * policy before streaming a byte, and there is no public link to one of these.
 * Loading it needs the usual bearer token, so it cannot be handed straight to
 * an image loader without the auth header.
 */
@Serializable
data class ProgressPhoto(
    val id: String,
    @SerialName("body_metric_id") val bodyMetricId: String? = null,
    @SerialName("taken_on") val takenOn: String,
    val caption: String? = null,
    val mime: String = "",
    @SerialName("size_bytes") val sizeBytes: Long = 0,
    val url: String,
)

/** Everything `GET workout-stats` returns, server-computed. */
@Serializable
data class WorkoutStats(
    val timezone: String = "UTC",
    val today: WorkoutTotals = WorkoutTotals(),
    val week: WorkoutTotals = WorkoutTotals(),
    val history: WorkoutTotals = WorkoutTotals(),
    val days: List<WorkoutDayBucket> = emptyList(),
    val categories: List<WorkoutCategoryBucket> = emptyList(),
    val calendar: List<WorkoutCalendarDay> = emptyList(),
    @SerialName("streak_days") val streakDays: Int = 0,
    @SerialName("longest_streak_days") val longestStreakDays: Int = 0,
    @SerialName("sessions_this_week") val sessionsThisWeek: Int = 0,
    @SerialName("history_days") val historyDays: Int = 90,
    @SerialName("chart_days") val chartDays: Int = 7,
    val records: List<WorkoutRecord> = emptyList(),
)

@Serializable
data class WorkoutTotals(
    val sets: Int = 0,
    @SerialName("volume_grams") val volumeGrams: Long = 0,
    val reps: Int = 0,
    @SerialName("distance_metres") val distanceMetres: Long = 0,
    @SerialName("duration_seconds") val durationSeconds: Long = 0,
    val sessions: Int = 0,
)

@Serializable
data class WorkoutDayBucket(
    val date: String,
    val label: String,
    val sets: Int = 0,
    @SerialName("volume_grams") val volumeGrams: Long = 0,
)

@Serializable
data class WorkoutCategoryBucket(
    val category: String? = null,
    val sets: Int = 0,
    @SerialName("volume_grams") val volumeGrams: Long = 0,
)

@Serializable
data class WorkoutCalendarDay(
    val date: String,
    val trained: Boolean = false,
    val sets: Int = 0,
    @SerialName("volume_grams") val volumeGrams: Long = 0,
)

/** One exercise's bests. Every measure is null unless the exercise tracks it. */
@Serializable
data class WorkoutRecord(
    @SerialName("exercise_id") val exerciseId: String,
    @SerialName("exercise_name") val exerciseName: String? = null,
    val category: String? = null,
    val metric: String? = null,
    @SerialName("sets_logged") val setsLogged: Int = 0,
    @SerialName("last_performed_at") val lastPerformedAt: String? = null,
    @SerialName("best_one_rep_max_grams") val bestOneRepMaxGrams: Int? = null,
    @SerialName("best_weight_grams") val bestWeightGrams: Int? = null,
    @SerialName("best_reps") val bestReps: Int? = null,
    @SerialName("best_distance_metres") val bestDistanceMetres: Int? = null,
    @SerialName("best_duration_seconds") val bestDurationSeconds: Int? = null,
    @SerialName("best_volume_grams") val bestVolumeGrams: Long? = null,
)

/**
 * Reply from `exercises/{id}/history` - the progressive-overload panel, which
 * is what lets the live screen show what you lifted last time without
 * leaving the workout.
 */
@Serializable
data class ExerciseHistory(
    @SerialName("exercise_id") val exerciseId: String,
    val metric: String = "",
    val sessions: List<ExerciseHistorySession> = emptyList(),
    val best: WorkoutBest = WorkoutBest(),
)

@Serializable
data class ExerciseHistorySession(
    @SerialName("session_id") val sessionId: String,
    @SerialName("performed_at") val performedAt: String? = null,
    @SerialName("routine_name") val routineName: String? = null,
    val sets: List<ExerciseHistorySet> = emptyList(),
)

@Serializable
data class ExerciseHistorySet(
    val id: String,
    val position: Int = 0,
    val reps: Int? = null,
    @SerialName("weight_grams") val weightGrams: Int? = null,
    @SerialName("distance_metres") val distanceMetres: Int? = null,
    @SerialName("duration_seconds") val durationSeconds: Int? = null,
    val rpe: Int? = null,
    @SerialName("one_rep_max_grams") val oneRepMaxGrams: Int? = null,
)

@Serializable
data class WorkoutBest(
    @SerialName("best_one_rep_max_grams") val bestOneRepMaxGrams: Int? = null,
    @SerialName("best_weight_grams") val bestWeightGrams: Int? = null,
    @SerialName("best_reps") val bestReps: Int? = null,
    @SerialName("best_distance_metres") val bestDistanceMetres: Int? = null,
    @SerialName("best_duration_seconds") val bestDurationSeconds: Int? = null,
    @SerialName("best_volume_grams") val bestVolumeGrams: Long? = null,
)
