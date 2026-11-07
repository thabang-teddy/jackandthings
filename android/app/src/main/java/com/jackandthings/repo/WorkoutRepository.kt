package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.ReminderState
import com.jackandthings.model.WorkoutEntry

interface WorkoutRepository {
    suspend fun list(): Result<List<WorkoutEntry>>

    /** Read by both the screen banner and the hourly reminder worker. */
    suspend fun reminderState(): Result<ReminderState>

    suspend fun create(activity: String, notes: String?): Result<WorkoutEntry>

    suspend fun delete(id: String): Result<Unit>
}

class ApiWorkoutRepository(private val api: JackApi) : WorkoutRepository {

    override suspend fun list(): Result<List<WorkoutEntry>> = apiCall { api.workoutEntries() }

    override suspend fun reminderState(): Result<ReminderState> = apiCall { api.reminderState() }

    override suspend fun create(activity: String, notes: String?): Result<WorkoutEntry> =
        apiCall { api.createWorkoutEntry(activity, notes) }

    override suspend fun delete(id: String): Result<Unit> = apiCall { api.deleteWorkoutEntry(id) }
}
