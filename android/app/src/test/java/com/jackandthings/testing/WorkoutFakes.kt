package com.jackandthings.testing

import com.jackandthings.data.remote.LoggedSet
import com.jackandthings.model.BodyMetric
import com.jackandthings.model.BodyMetricDraft
import com.jackandthings.model.Exercise
import com.jackandthings.model.ExerciseDraft
import com.jackandthings.model.ExerciseHistory
import com.jackandthings.model.ProgressPhoto
import com.jackandthings.model.WorkoutRoutine
import com.jackandthings.model.WorkoutRoutineDraft
import com.jackandthings.model.WorkoutSession
import com.jackandthings.model.WorkoutSessionDraft
import com.jackandthings.model.WorkoutSet
import com.jackandthings.model.WorkoutSetDraft
import com.jackandthings.model.WorkoutStats
import com.jackandthings.repo.BodyRepository
import com.jackandthings.repo.ExerciseRepository
import com.jackandthings.repo.TrainingRepository

/**
 * Fakes for issue #4's three repositories, in the same shape as the ones in
 * Fakes.kt: seeded data as a constructor var, a `failure` injection point, and
 * a public recording list per write so a test can assert what was asked for
 * rather than what came back.
 *
 * They mimic the server's side effects where a test would otherwise be
 * meaningless - logging a set has to appear in the session, or
 * TrainingViewModel's reload would be asserting nothing.
 */

class FakeExerciseRepository(
    var exercises: MutableList<Exercise> = mutableListOf(),
    var history: ExerciseHistory? = null,
) : ExerciseRepository {

    var failure: Throwable? = null

    /** Set separately: the history is a nicety and must not break the list. */
    var historyFailure: Throwable? = null

    val created: MutableList<ExerciseDraft> = mutableListOf()
    val updated: MutableList<Pair<String, ExerciseDraft>> = mutableListOf()
    val deletedIds: MutableList<String> = mutableListOf()

    override suspend fun list(): Result<List<Exercise>> =
        failure?.let { Result.failure(it) } ?: Result.success(exercises.toList())

    override suspend fun history(exerciseId: String): Result<ExerciseHistory?> =
        historyFailure?.let { Result.failure(it) } ?: Result.success(history)

    override suspend fun create(draft: ExerciseDraft): Result<Exercise> {
        failure?.let { return Result.failure(it) }
        created.add(draft)

        val exercise = Exercise(
            id = "ex-${exercises.size + 1}",
            name = draft.name,
            category = draft.category,
            metric = draft.metric,
            isCustom = true,
        )
        exercises.add(exercise)

        return Result.success(exercise)
    }

    override suspend fun update(id: String, draft: ExerciseDraft): Result<Exercise> {
        failure?.let { return Result.failure(it) }
        updated.add(id to draft)

        val index = exercises.indexOfFirst { it.id == id }
        if (index >= 0) {
            exercises[index] = exercises[index].copy(name = draft.name)
        }

        return Result.success(exercises.getOrElse(index) { exercises.first() })
    }

    override suspend fun delete(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }
        deletedIds.add(id)
        exercises.removeAll { it.id == id }

        return Result.success(Unit)
    }
}

class FakeTrainingRepository(
    var routines: MutableList<WorkoutRoutine> = mutableListOf(),
    var sessions: MutableList<WorkoutSession> = mutableListOf(),
    var current: WorkoutSession? = null,
    var stats: WorkoutStats = WorkoutStats(),
) : TrainingRepository {

    var failure: Throwable? = null

    /** The verdict the server would return for the next logged set. */
    var nextSetIsRecord: Boolean = false

    val startedRoutineIds: MutableList<String?> = mutableListOf()
    val loggedSets: MutableList<Pair<String, WorkoutSetDraft>> = mutableListOf()
    val finishedIds: MutableList<String> = mutableListOf()
    val deletedSetIds: MutableList<String> = mutableListOf()
    val deletedSessionIds: MutableList<String> = mutableListOf()
    val createdRoutines: MutableList<WorkoutRoutineDraft> = mutableListOf()
    val statsTimezones: MutableList<String> = mutableListOf()

    override suspend fun routines(): Result<List<WorkoutRoutine>> =
        failure?.let { Result.failure(it) } ?: Result.success(routines.toList())

    override suspend fun createRoutine(draft: WorkoutRoutineDraft): Result<WorkoutRoutine> {
        failure?.let { return Result.failure(it) }
        createdRoutines.add(draft)

        val routine = WorkoutRoutine(id = "routine-${routines.size + 1}", name = draft.name)
        routines.add(routine)

        return Result.success(routine)
    }

    override suspend fun updateRoutine(
        id: String,
        draft: WorkoutRoutineDraft,
    ): Result<WorkoutRoutine> {
        failure?.let { return Result.failure(it) }

        return Result.success(WorkoutRoutine(id = id, name = draft.name))
    }

    override suspend fun deleteRoutine(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }
        routines.removeAll { it.id == id }

        return Result.success(Unit)
    }

    override suspend fun sessions(): Result<List<WorkoutSession>> =
        failure?.let { Result.failure(it) } ?: Result.success(sessions.toList())

    override suspend fun currentSession(): Result<WorkoutSession?> =
        failure?.let { Result.failure(it) } ?: Result.success(current)

    override suspend fun startSession(draft: WorkoutSessionDraft): Result<WorkoutSession> {
        failure?.let { return Result.failure(it) }
        startedRoutineIds.add(draft.workoutRoutineId)

        val session = WorkoutSession(
            id = "session-1",
            workoutRoutineId = draft.workoutRoutineId,
            routineName = routines.firstOrNull { it.id == draft.workoutRoutineId }?.name,
            isOpen = true,
        )
        current = session

        return Result.success(session)
    }

    override suspend fun finishSession(id: String): Result<WorkoutSession> {
        failure?.let { return Result.failure(it) }
        finishedIds.add(id)

        val finished = (current ?: WorkoutSession(id = id)).copy(isOpen = false)
        current = null
        sessions.add(finished)

        return Result.success(finished)
    }

    override suspend fun deleteSession(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }
        deletedSessionIds.add(id)
        sessions.removeAll { it.id == id }

        return Result.success(Unit)
    }

    override suspend fun logSet(
        sessionId: String,
        draft: WorkoutSetDraft,
    ): Result<LoggedSet> {
        failure?.let { return Result.failure(it) }
        loggedSets.add(sessionId to draft)

        val set = WorkoutSet(
            id = "set-${loggedSets.size}",
            workoutSessionId = sessionId,
            exerciseId = draft.exerciseId,
            position = loggedSets.size,
            isWarmup = draft.isWarmup,
            reps = draft.reps,
            weightGrams = draft.weightGrams,
        )

        // The server would return the session with the set on it, so the
        // reload the ViewModel does afterwards has to see it too.
        current = current?.let { it.copy(sets = it.sets + set, setCount = it.setCount + 1) }

        return Result.success(LoggedSet(set = set, isRecord = nextSetIsRecord))
    }

    override suspend fun deleteSet(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }
        deletedSetIds.add(id)
        current = current?.let { session ->
            session.copy(sets = session.sets.filterNot { it.id == id })
        }

        return Result.success(Unit)
    }

    override suspend fun stats(timezone: String): Result<WorkoutStats> {
        statsTimezones.add(timezone)

        return failure?.let { Result.failure(it) } ?: Result.success(stats)
    }
}

class FakeBodyRepository(
    var metrics: MutableList<BodyMetric> = mutableListOf(),
    var photos: MutableList<ProgressPhoto> = mutableListOf(),
) : BodyRepository {

    var failure: Throwable? = null

    /** Set separately: losing the photos must not hide the figures. */
    var photoFailure: Throwable? = null

    val saved: MutableList<BodyMetricDraft> = mutableListOf()
    val uploads: MutableList<Triple<String, String, Int>> = mutableListOf()
    val deletedMetricIds: MutableList<String> = mutableListOf()
    val deletedPhotoIds: MutableList<String> = mutableListOf()

    override suspend fun metrics(): Result<List<BodyMetric>> =
        failure?.let { Result.failure(it) } ?: Result.success(metrics.toList())

    override suspend fun saveMetric(draft: BodyMetricDraft): Result<BodyMetric> {
        failure?.let { return Result.failure(it) }
        saved.add(draft)

        // The server replaces a day that already has a reading rather than
        // adding a second, so the fake does the same.
        metrics.removeAll { it.measuredOn == draft.measuredOn }

        val metric = BodyMetric(
            id = "metric-${metrics.size + 1}",
            measuredOn = draft.measuredOn,
            weightGrams = draft.weightGrams,
            bodyFatPermille = draft.bodyFatPermille,
            measurements = draft.measurements,
        )
        metrics.add(metric)

        return Result.success(metric)
    }

    override suspend fun deleteMetric(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }
        deletedMetricIds.add(id)
        metrics.removeAll { it.id == id }

        return Result.success(Unit)
    }

    override suspend fun photos(): Result<List<ProgressPhoto>> =
        photoFailure?.let { Result.failure(it) } ?: Result.success(photos.toList())

    override suspend fun uploadPhoto(
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
        takenOn: String,
        caption: String?,
        bodyMetricId: String?,
    ): Result<ProgressPhoto> {
        failure?.let { return Result.failure(it) }
        uploads.add(Triple(fileName, mimeType, bytes.size))

        val photo = ProgressPhoto(
            id = "photo-${photos.size + 1}",
            takenOn = takenOn,
            caption = caption,
            mime = mimeType,
            url = "https://example.test/photo",
        )
        photos.add(photo)

        return Result.success(photo)
    }

    override suspend fun deletePhoto(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }
        deletedPhotoIds.add(id)
        photos.removeAll { it.id == id }

        return Result.success(Unit)
    }
}
