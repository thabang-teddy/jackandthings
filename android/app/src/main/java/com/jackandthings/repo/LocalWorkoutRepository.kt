package com.jackandthings.repo

import com.jackandthings.data.local.JsonFileStore
import com.jackandthings.model.ReminderState
import com.jackandthings.model.WorkoutEntry
import com.jackandthings.model.WorkoutPreset
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * Backs the Workout module while there is no signed-in session to log to.
 *
 * Mirrors `WorkoutReminderStatus` on the server: due means nothing has been
 * logged since the start of the current hour.
 */
class LocalWorkoutRepository(private val store: JsonFileStore<WorkoutEntry>) : WorkoutRepository {

    override suspend fun list(): Result<List<WorkoutEntry>> =
        Result.success(store.read().sortedByDescending { it.loggedAt })

    override suspend fun reminderState(): Result<ReminderState> {
        val logged = store.read().mapNotNull { entry ->
            entry.loggedAt?.let { raw -> runCatching { Instant.parse(raw) }.getOrNull()?.to(raw) }
        }
        val startOfHour = Instant.now().truncatedTo(ChronoUnit.HOURS)
        val due = logged.none { (loggedAt, _) -> !loggedAt.isBefore(startOfHour) }
        val lastLoggedAt = logged.maxByOrNull { (loggedAt, _) -> loggedAt }?.second

        return Result.success(ReminderState(due = due, lastLoggedAt = lastLoggedAt))
    }

    /**
     * Always empty: presets are only ever created against an account, so a
     * device that has never signed in has none to offer.
     */
    override suspend fun presets(): Result<List<WorkoutPreset>> = Result.success(emptyList())

    override suspend fun create(
        activity: String,
        notes: String?,
        loggedAt: String?,
    ): Result<WorkoutEntry> {
        val entry = WorkoutEntry(
            id = UUID.randomUUID().toString(),
            activity = activity,
            notes = notes,
            loggedAt = loggedAt ?: Instant.now().toString(),
        )
        store.write(store.read() + entry)
        return Result.success(entry)
    }

    override suspend fun delete(id: String): Result<Unit> {
        store.write(store.read().filterNot { it.id == id })
        return Result.success(Unit)
    }
}
