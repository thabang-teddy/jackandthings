package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.Exercise
import com.jackandthings.model.ExerciseDraft
import com.jackandthings.model.ExerciseHistory

/**
 * The exercise library: the server's seeded catalog plus the user's own.
 *
 * Unlike the five repositories that came before it, this one has no local,
 * signed-out implementation. The catalog is server-seeded reference data -
 * there is nothing sensible to show a signed-out user, and inventing a
 * shipped-in-the-app copy would mean two catalogs to keep in step. The
 * offline decorator caches what has been seen so a workout can still be
 * reviewed on a train; writes need the server.
 */
interface ExerciseRepository {
    suspend fun list(): Result<List<Exercise>>

    /**
     * What the user did the last few times they trained this exercise, plus
     * their bests. Null means they never have - which the screen shows as "no
     * history yet" rather than as zeroes, because the two mean different
     * things.
     */
    suspend fun history(exerciseId: String): Result<ExerciseHistory?>

    suspend fun create(draft: ExerciseDraft): Result<Exercise>

    suspend fun update(id: String, draft: ExerciseDraft): Result<Exercise>

    /** Refused by the server while a routine or a logged set still uses it. */
    suspend fun delete(id: String): Result<Unit>
}

class ApiExerciseRepository(private val api: JackApi) : ExerciseRepository {

    override suspend fun list(): Result<List<Exercise>> = apiCall { api.exercises() }

    override suspend fun history(exerciseId: String): Result<ExerciseHistory?> =
        apiCall { api.exerciseHistory(exerciseId) }

    override suspend fun create(draft: ExerciseDraft): Result<Exercise> =
        apiCall { api.createExercise(draft) }

    override suspend fun update(id: String, draft: ExerciseDraft): Result<Exercise> =
        apiCall { api.updateExercise(id, draft) }

    override suspend fun delete(id: String): Result<Unit> = apiCall { api.deleteExercise(id) }
}
