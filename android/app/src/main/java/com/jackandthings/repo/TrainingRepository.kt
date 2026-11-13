package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.data.remote.LoggedSet
import com.jackandthings.model.WorkoutRoutine
import com.jackandthings.model.WorkoutRoutineDraft
import com.jackandthings.model.WorkoutSession
import com.jackandthings.model.WorkoutSessionDraft
import com.jackandthings.model.WorkoutSetDraft
import com.jackandthings.model.WorkoutStats

/**
 * Routines, workouts, the sets logged against them, and the stats computed
 * from all of it.
 *
 * Grouped into one interface rather than three because they are one
 * conversation: a screen that starts a workout immediately needs the routine
 * it came from and the sets going into it, and splitting them would mean every
 * ViewModel taking three collaborators to do one job.
 *
 * Writes here need the server and are not queued offline. That is a deliberate
 * limit rather than an oversight: the outbox serialises standalone drafts, and
 * a set queued against a session that does not exist on the server yet would
 * need session-id remapping inside the drainer before it could ever be
 * replayed. The one-line workout entry log keeps its offline queue; this does
 * not. docs/TESTING.md records it.
 */
interface TrainingRepository {
    suspend fun routines(): Result<List<WorkoutRoutine>>

    suspend fun createRoutine(draft: WorkoutRoutineDraft): Result<WorkoutRoutine>

    suspend fun updateRoutine(id: String, draft: WorkoutRoutineDraft): Result<WorkoutRoutine>

    suspend fun deleteRoutine(id: String): Result<Unit>

    suspend fun sessions(): Result<List<WorkoutSession>>

    /** The workout in progress, or null when nothing is running. */
    suspend fun currentSession(): Result<WorkoutSession?>

    suspend fun startSession(draft: WorkoutSessionDraft): Result<WorkoutSession>

    /** The server stamps the finishing time, not the phone. */
    suspend fun finishSession(id: String): Result<WorkoutSession>

    suspend fun deleteSession(id: String): Result<Unit>

    /**
     * Logs one set. The reply carries the server's own verdict on whether it
     * was a personal best, so the screen can celebrate it without a second
     * request mid-workout.
     */
    suspend fun logSet(sessionId: String, draft: WorkoutSetDraft): Result<LoggedSet>

    suspend fun deleteSet(id: String): Result<Unit>

    /** [timezone] is an IANA zone; the server buckets in it rather than UTC. */
    suspend fun stats(timezone: String): Result<WorkoutStats>
}

class ApiTrainingRepository(private val api: JackApi) : TrainingRepository {

    override suspend fun routines(): Result<List<WorkoutRoutine>> =
        apiCall { api.workoutRoutines() }

    override suspend fun createRoutine(draft: WorkoutRoutineDraft): Result<WorkoutRoutine> =
        apiCall { api.createWorkoutRoutine(draft) }

    override suspend fun updateRoutine(
        id: String,
        draft: WorkoutRoutineDraft,
    ): Result<WorkoutRoutine> = apiCall { api.updateWorkoutRoutine(id, draft) }

    override suspend fun deleteRoutine(id: String): Result<Unit> =
        apiCall { api.deleteWorkoutRoutine(id) }

    override suspend fun sessions(): Result<List<WorkoutSession>> =
        apiCall { api.workoutSessions() }

    override suspend fun currentSession(): Result<WorkoutSession?> =
        apiCall { api.currentWorkoutSession() }

    override suspend fun startSession(draft: WorkoutSessionDraft): Result<WorkoutSession> =
        apiCall { api.startWorkoutSession(draft) }

    override suspend fun finishSession(id: String): Result<WorkoutSession> =
        apiCall { api.finishWorkoutSession(id) }

    override suspend fun deleteSession(id: String): Result<Unit> =
        apiCall { api.deleteWorkoutSession(id) }

    override suspend fun logSet(sessionId: String, draft: WorkoutSetDraft): Result<LoggedSet> =
        apiCall { api.logWorkoutSet(sessionId, draft) }

    override suspend fun deleteSet(id: String): Result<Unit> = apiCall { api.deleteWorkoutSet(id) }

    override suspend fun stats(timezone: String): Result<WorkoutStats> =
        apiCall { api.workoutStats(timezone) }
}
