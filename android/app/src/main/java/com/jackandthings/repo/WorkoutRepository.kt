package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.ReminderState
import com.jackandthings.model.WorkoutEntry

class WorkoutRepository(private val api: JackApi) {

    suspend fun list(): Result<List<WorkoutEntry>> = apiCall { api.workoutEntries() }

    /** Read by both the screen banner and the hourly reminder worker. */
    suspend fun reminderState(): Result<ReminderState> = apiCall { api.reminderState() }

    suspend fun create(activity: String, notes: String?): Result<WorkoutEntry> =
        apiCall { api.createWorkoutEntry(activity, notes) }

    suspend fun delete(id: String): Result<Unit> = apiCall { api.deleteWorkoutEntry(id) }
}
