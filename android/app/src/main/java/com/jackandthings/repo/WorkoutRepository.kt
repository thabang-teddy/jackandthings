package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.ReminderState
import com.jackandthings.model.WorkoutEntry
import com.jackandthings.model.WorkoutPreset

interface WorkoutRepository {
    suspend fun list(): Result<List<WorkoutEntry>>

    /** Read by both the screen banner and the hourly reminder worker. */
    suspend fun reminderState(): Result<ReminderState>

    /** Named activities to log in one tap, offered by the dashboard. */
    suspend fun presets(): Result<List<WorkoutPreset>>

    /**
     * [loggedAt] is an ISO-8601 instant, and only replays pass one: a workout
     * recorded offline happened when the user logged it, not when the queue
     * finally reached the server. Left null, the server stamps it now.
     */
    suspend fun create(
        activity: String,
        notes: String?,
        loggedAt: String? = null,
    ): Result<WorkoutEntry>

    suspend fun delete(id: String): Result<Unit>
}

class ApiWorkoutRepository(private val api: JackApi) : WorkoutRepository {

    override suspend fun list(): Result<List<WorkoutEntry>> = apiCall { api.workoutEntries() }

    override suspend fun reminderState(): Result<ReminderState> = apiCall { api.reminderState() }

    override suspend fun presets(): Result<List<WorkoutPreset>> = apiCall { api.workoutPresets() }

    override suspend fun create(
        activity: String,
        notes: String?,
        loggedAt: String?,
    ): Result<WorkoutEntry> = apiCall { api.createWorkoutEntry(activity, notes, loggedAt) }

    override suspend fun delete(id: String): Result<Unit> = apiCall { api.deleteWorkoutEntry(id) }
}
