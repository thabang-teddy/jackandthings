package com.jackandthings.data.remote

import com.jackandthings.model.BodyMetric
import com.jackandthings.model.BodyMetricDraft
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetCategory
import com.jackandthings.model.BudgetDue
import com.jackandthings.model.BudgetGoal
import com.jackandthings.model.BudgetGoalDraft
import com.jackandthings.model.BudgetLimitState
import com.jackandthings.model.BudgetReceipt
import com.jackandthings.model.BudgetReport
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.Exercise
import com.jackandthings.model.ExerciseDraft
import com.jackandthings.model.ExerciseHistory
import com.jackandthings.model.Note
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.PomodoroPresetDraft
import com.jackandthings.model.PomodoroSession
import com.jackandthings.model.PomodoroSessionDraft
import com.jackandthings.model.PomodoroStats
import com.jackandthings.model.ProgressPhoto
import com.jackandthings.model.RecurringTransaction
import com.jackandthings.model.ReminderState
import com.jackandthings.model.TokenPayload
import com.jackandthings.model.WatchList
import com.jackandthings.model.WatchListItem
import com.jackandthings.model.WorkoutEntry
import com.jackandthings.model.WorkoutPreset
import com.jackandthings.model.WorkoutRoutine
import com.jackandthings.model.WorkoutRoutineDraft
import com.jackandthings.model.WorkoutSession
import com.jackandthings.model.WorkoutSessionDraft
import com.jackandthings.model.WorkoutSet
import com.jackandthings.model.WorkoutSetDraft
import com.jackandthings.model.WorkoutStats
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

/**
 * A logged set with the server's own verdict on whether it was a personal
 * best. The flag rides along with the row because the screen has to celebrate
 * it immediately, and asking a second endpoint mid-workout would be a round
 * trip for something the server already knew.
 */
data class LoggedSet(val set: WorkoutSet, val isRecord: Boolean)

/**
 * One method per endpoint of the `api/v1` contract, so the shape of the server
 * lives in a single file. Paths are relative to the client's base URL.
 */
class JackApi(private val client: ApiClient) {

    // ── Auth ───────────────────────────────────────────────────────────────

    suspend fun requestToken(email: String, password: String, deviceName: String): TokenPayload =
        client.post(
            "auth/token",
            buildJsonObject {
                put("email", email)
                put("password", password)
                put("device_name", deviceName)
            },
        ).decode()

    /** Revokes only this device's token, leaving other sign-ins alone. */
    suspend fun revokeToken() = client.delete("auth/token")

    // ── Notes ──────────────────────────────────────────────────────────────

    suspend fun notes(): List<Note> = client.get("notes").decodeList()

    suspend fun createNote(title: String, body: String?): Note =
        client.post("notes", noteBody(title, body)).decode()

    suspend fun updateNote(id: String, title: String, body: String?): Note =
        client.put("notes/$id", noteBody(title, body)).decode()

    /**
     * The server validates only the fields present, so the star travels on
     * its own rather than round-tripping a title and body this does not own.
     */
    suspend fun starNote(id: String, isStarred: Boolean): Note =
        client.put("notes/$id", buildJsonObject { put("is_starred", isStarred) }).decode()

    suspend fun deleteNote(id: String) = client.delete("notes/$id")

    private fun noteBody(title: String, body: String?) = buildJsonObject {
        put("title", title)
        put("body", body ?: "")
    }

    // ── Pomodoro ───────────────────────────────────────────────────────────

    suspend fun presets(): List<PomodoroPreset> = client.get("pomodoro-presets").decodeList()

    /**
     * The draft is serialised whole rather than assembled field by field with
     * buildJsonObject: its @SerialName annotations already spell the wire
     * names, and hand-copying fourteen of them is one typo away from a field
     * that silently never reaches the server.
     */
    suspend fun createPreset(draft: PomodoroPresetDraft): PomodoroPreset =
        client.post("pomodoro-presets", draft.asJsonObject()).decode()

    suspend fun updatePreset(id: String, draft: PomodoroPresetDraft): PomodoroPreset =
        client.put("pomodoro-presets/$id", draft.asJsonObject()).decode()

    suspend fun deletePreset(id: String) = client.delete("pomodoro-presets/$id")

    // ── Pomodoro sessions ──────────────────────────────────────────────────

    suspend fun pomodoroSessions(limit: Int = 50): List<PomodoroSession> =
        client.get("pomodoro-sessions", mapOf("limit" to limit.toString())).decodeList()

    suspend fun createPomodoroSession(draft: PomodoroSessionDraft): PomodoroSession =
        client.post("pomodoro-sessions", draft.asJsonObject()).decode()

    suspend fun deletePomodoroSession(id: String) = client.delete("pomodoro-sessions/$id")

    /** [timezone] is an IANA zone; the server buckets in it rather than UTC. */
    suspend fun pomodoroStats(timezone: String): PomodoroStats =
        client.get("pomodoro-sessions/stats", mapOf("tz" to timezone)).decode()

    // ── Watch list ─────────────────────────────────────────────────────────

    /** Lists come back with their items nested (the index eager-loads them). */
    suspend fun watchLists(): List<WatchList> =
        client.get("watch-lists").decodeList()

    suspend fun createWatchList(name: String): WatchList =
        client.post("watch-lists", buildJsonObject { put("name", name) }).decode()

    suspend fun deleteWatchList(id: String) = client.delete("watch-lists/$id")

    suspend fun createWatchListItem(
        watchListId: String,
        title: String,
        note: String?,
    ): WatchListItem = client.post(
        "watch-list-items",
        buildJsonObject {
            put("watch_list_id", watchListId)
            put("title", title)
            note?.let { put("note", it) }
        },
    ).decode()

    suspend fun updateWatchListItem(id: String, done: Boolean): WatchListItem =
        client.put(
            "watch-list-items/$id",
            buildJsonObject { put("done", done) },
        ).decode()

    suspend fun deleteWatchListItem(id: String) = client.delete("watch-list-items/$id")

    // ── Workout ────────────────────────────────────────────────────────────

    suspend fun workoutEntries(): List<WorkoutEntry> =
        client.get("workout-entries").decodeList()

    /** Reminder state for this device to act on; the server sends nothing. */
    suspend fun reminderState(): ReminderState = client.get("workout-entries/due").decode()

    /** [loggedAt] is an optional ISO datetime; the server defaults to now. */
    suspend fun createWorkoutEntry(
        activity: String,
        notes: String?,
        loggedAt: String? = null,
    ): WorkoutEntry =
        client.post(
            "workout-entries",
            buildJsonObject {
                put("activity", activity)
                put("notes", notes ?: "")
                if (loggedAt != null) {
                    put("logged_at", loggedAt)
                }
            },
        ).decode()

    suspend fun deleteWorkoutEntry(id: String) = client.delete("workout-entries/$id")

    suspend fun workoutPresets(): List<WorkoutPreset> =
        client.get("workout-presets").decodeList()

    suspend fun createWorkoutPreset(name: String, activity: String): WorkoutPreset =
        client.post(
            "workout-presets",
            buildJsonObject {
                put("name", name)
                put("activity", activity)
            },
        ).decode()

    suspend fun deleteWorkoutPreset(id: String) = client.delete("workout-presets/$id")

    // ── Exercise library ───────────────────────────────────────────────────

    /** The seeded catalog plus this user's own exercises, in one list. */
    suspend fun exercises(): List<Exercise> =
        client.get("exercises").decodeList()

    suspend fun createExercise(draft: ExerciseDraft): Exercise =
        client.post("exercises", draft.asJsonObject()).decode()

    suspend fun updateExercise(id: String, draft: ExerciseDraft): Exercise =
        client.put("exercises/$id", draft.asJsonObject()).decode()

    /** Refused with a 422 while a routine or a logged set still uses it. */
    suspend fun deleteExercise(id: String) = client.delete("exercises/$id")

    /**
     * What the user did the last few times they trained this exercise, plus
     * their bests. The reply's `data` is null when they never have, which is
     * why this returns a nullable rather than an empty history - "no data yet"
     * and "no progress" are different things to show.
     */
    suspend fun exerciseHistory(id: String): ExerciseHistory? =
        client.get("exercises/$id/history").optionalPayload()?.let {
            client.json.decodeFromJsonElement(it)
        }

    // ── Workout routines ───────────────────────────────────────────────────

    suspend fun workoutRoutines(): List<WorkoutRoutine> =
        client.get("workout-routines").decodeList()

    /**
     * Sent whole rather than field by field: a routine without its items is
     * not half-saved, it is broken, so the two travel together.
     */
    suspend fun createWorkoutRoutine(draft: WorkoutRoutineDraft): WorkoutRoutine =
        client.post("workout-routines", draft.asJsonObject()).decode()

    suspend fun updateWorkoutRoutine(id: String, draft: WorkoutRoutineDraft): WorkoutRoutine =
        client.put("workout-routines/$id", draft.asJsonObject()).decode()

    suspend fun deleteWorkoutRoutine(id: String) = client.delete("workout-routines/$id")

    // ── Workout sessions and sets ──────────────────────────────────────────

    suspend fun workoutSessions(): List<WorkoutSession> =
        client.get("workout-sessions").decodeList()

    /**
     * The workout in progress, or null. Null is a normal answer here, not an
     * error: most of the time there is no workout running.
     */
    suspend fun currentWorkoutSession(): WorkoutSession? =
        client.get("workout-sessions/current").optionalPayload()?.let {
            client.json.decodeFromJsonElement(it)
        }

    suspend fun startWorkoutSession(draft: WorkoutSessionDraft): WorkoutSession =
        client.post("workout-sessions", draft.asJsonObject()).decode()

    /**
     * Closes the workout. The server stamps the time, so a stopwatch on the
     * phone cannot drift into the stored record.
     */
    suspend fun finishWorkoutSession(id: String): WorkoutSession =
        client.post("workout-sessions/$id/finish").decode()

    suspend fun deleteWorkoutSession(id: String) = client.delete("workout-sessions/$id")

    /**
     * Logs one set. The reply's `is_record` is the server's own verdict on
     * whether it was a personal best, which is what the screen celebrates -
     * WorkoutProgress.beatsPrevious only has to agree with it.
     */
    suspend fun logWorkoutSet(sessionId: String, draft: WorkoutSetDraft): LoggedSet {
        val reply = client.post("workout-sessions/$sessionId/sets", draft.asJsonObject())

        return LoggedSet(
            set = client.json.decodeFromJsonElement(reply.payload()),
            isRecord = reply.jsonObject["is_record"]?.let { element ->
                runCatching { client.json.decodeFromJsonElement<Boolean>(element) }.getOrDefault(false)
            } ?: false,
        )
    }

    suspend fun deleteWorkoutSet(id: String) = client.delete("workout-sets/$id")

    // ── Body metrics ───────────────────────────────────────────────────────

    suspend fun bodyMetrics(): List<BodyMetric> =
        client.get("body-metrics").decodeList()

    /** A day that already has a reading is updated rather than refused. */
    suspend fun saveBodyMetric(draft: BodyMetricDraft): BodyMetric =
        client.post("body-metrics", draft.asJsonObject()).decode()

    suspend fun deleteBodyMetric(id: String) = client.delete("body-metrics/$id")

    // ── Progress photos ────────────────────────────────────────────────────

    /**
     * The records only. The images themselves are fetched from each row's
     * `url`, which is an authorized endpoint - uploading one is a multipart
     * request and is deliberately not queued offline; see
     * OfflineRepositories and docs/TESTING.md.
     */
    suspend fun progressPhotos(): List<ProgressPhoto> =
        client.get("progress-photos").decodeList()

    /**
     * Uploads one image. [bytes] is the picked file already read into memory,
     * and [mimeType] comes from the picker rather than from a filename - the
     * server validates it again against its own four-type allow-list and
     * decides the stored extension from that, so a wrong guess here is
     * refused rather than trusted.
     */
    suspend fun uploadProgressPhoto(
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
        takenOn: String,
        caption: String? = null,
        bodyMetricId: String? = null,
    ): ProgressPhoto =
        client.postMultipart(
            path = "progress-photos",
            fileField = "photo",
            fileName = fileName,
            mimeType = mimeType,
            bytes = bytes,
            fields = buildMap {
                put("taken_on", takenOn)
                caption?.takeIf { it.isNotBlank() }?.let { put("caption", it) }
                bodyMetricId?.let { put("body_metric_id", it) }
            },
        ).decode()

    suspend fun deleteProgressPhoto(id: String) = client.delete("progress-photos/$id")

    // ── Workout stats ──────────────────────────────────────────────────────

    /** [timezone] is an IANA zone; the server buckets in it rather than UTC. */
    suspend fun workoutStats(timezone: String): WorkoutStats =
        client.get("workout-stats", mapOf("tz" to timezone)).decode()

    // ── Budget ─────────────────────────────────────────────────────────────

    suspend fun budgetAccounts(): List<BudgetAccount> =
        client.get("budget-accounts").decodeList()

    suspend fun createBudgetAccount(name: String): BudgetAccount =
        client.post("budget-accounts", buildJsonObject { put("name", name) }).decode()

    suspend fun deleteBudgetAccount(id: String) = client.delete("budget-accounts/$id")

    suspend fun budgetTransactions(): List<BudgetTransaction> =
        client.get("budget-transactions").decodeList()

    /**
     * [amount] is the major-unit string the user typed ("125.50"); the server
     * converts to cents. Sending the text avoids a float ever touching money.
     *
     * [occurredOn] is the business date, not the write time; [merchant] and
     * [categoryId] are the two optional columns added with issue #5.
     */
    suspend fun createTransaction(
        accountId: String,
        type: String,
        amount: String,
        description: String?,
        occurredOn: String? = null,
        merchant: String? = null,
        categoryId: String? = null,
    ): BudgetTransaction = client.post(
        "budget-transactions",
        buildJsonObject {
            put("account_id", accountId)
            put("type", type)
            put("amount", amount)
            put("description", description ?: "")
            occurredOn?.let { put("occurred_on", it) }
            merchant?.let { put("merchant", it) }
            categoryId?.let { put("category_id", it) }
        },
    ).decode()

    suspend fun deleteTransaction(id: String) = client.delete("budget-transactions/$id")

    /** Replies 204, so there is nothing to decode. */
    suspend fun transfer(
        fromAccountId: String,
        toAccountId: String,
        amount: String,
        description: String?,
    ) {
        client.post(
            "budget-transfers",
            buildJsonObject {
                put("from_account_id", fromAccountId)
                put("to_account_id", toAccountId)
                put("amount", amount)
                put("description", description ?: "")
            },
        )
    }

    // ── Budget categories, limits and goals ────────────────────────────────

    suspend fun budgetCategories(): List<BudgetCategory> =
        client.get("budget-categories").decodeList()

    suspend fun createBudgetCategory(name: String, kind: String): BudgetCategory =
        client.post(
            "budget-categories",
            buildJsonObject {
                put("name", name)
                put("kind", kind)
            },
        ).decode()

    suspend fun updateBudgetCategory(id: String, name: String, kind: String): BudgetCategory =
        client.put(
            "budget-categories/$id",
            buildJsonObject {
                put("name", name)
                put("kind", kind)
            },
        ).decode()

    suspend fun deleteBudgetCategory(id: String) = client.delete("budget-categories/$id")

    /**
     * The caps set for one `YYYY-MM` month. [period] is a query parameter so
     * the caller controls which month is shown rather than the server's clock.
     */
    suspend fun budgetLimits(period: String): List<BudgetLimitState> =
        client.get("budget-limits", mapOf("period" to period)).decodeList()

    /** [limit] is major-unit text; setting the same category and month edits it. */
    suspend fun saveBudgetLimit(
        categoryId: String,
        period: String,
        limit: String,
    ): BudgetLimitState =
        client.post(
            "budget-limits",
            buildJsonObject {
                put("category_id", categoryId)
                put("period", period)
                put("limit", limit)
            },
        ).decode()

    suspend fun deleteBudgetLimit(id: String) = client.delete("budget-limits/$id")

    suspend fun budgetGoals(): List<BudgetGoal> = client.get("budget-goals").decodeList()

    suspend fun createBudgetGoal(draft: BudgetGoalDraft): BudgetGoal =
        client.post("budget-goals", draft.asJsonObject()).decode()

    suspend fun updateBudgetGoal(id: String, draft: BudgetGoalDraft): BudgetGoal =
        client.put("budget-goals/$id", draft.asJsonObject()).decode()

    suspend fun deleteBudgetGoal(id: String) = client.delete("budget-goals/$id")

    /** Aggregates for one month plus the last [months] of in/out and net worth. */
    suspend fun budgetReport(period: String, months: Int = 6): BudgetReport =
        client.get("budget-reports", mapOf("period" to period, "months" to months.toString()))
            .decode()

    /** Bills inside their reminder window and caps near or over. */
    suspend fun budgetDue(period: String): BudgetDue =
        client.get("budget-due", mapOf("period" to period)).decode()

    // ── Budget receipts ────────────────────────────────────────────────────

    /**
     * Uploads one receipt for a transaction, replacing any earlier image.
     * [bytes] and [mimeType] come from the picker; the server sniffs the file
     * again against its own allow-list.
     */
    suspend fun uploadBudgetReceipt(
        transactionId: String,
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
    ): BudgetReceipt =
        client.postMultipart(
            path = "budget-transactions/$transactionId/receipt",
            fileField = "receipt",
            fileName = fileName,
            mimeType = mimeType,
            bytes = bytes,
        ).decode()

    suspend fun deleteBudgetReceipt(id: String) = client.delete("budget-receipts/$id")

    // ── Recurring ──────────────────────────────────────────────────────────

    suspend fun recurringTransactions(): List<RecurringTransaction> =
        client.get("recurring-transactions").decodeList()

    /**
     * [nextRunAt] is an ISO date (yyyy-MM-dd); [cadence] is daily/weekly/monthly.
     * The server converts [amount] text to cents, as with one-off transactions.
     */
    suspend fun createRecurring(
        accountId: String,
        type: String,
        amount: String,
        cadence: String,
        nextRunAt: String,
        description: String?,
    ): RecurringTransaction = client.post(
        "recurring-transactions",
        buildJsonObject {
            put("account_id", accountId)
            put("type", type)
            put("amount", amount)
            put("cadence", cadence)
            put("next_run_at", nextRunAt)
            put("description", description ?: "")
        },
    ).decode()

    suspend fun deleteRecurring(id: String) = client.delete("recurring-transactions/$id")

    // ── Decoding ───────────────────────────────────────────────────────────

    /** Every reply wraps its payload in `data`. */
    private fun JsonElement.payload(): JsonElement =
        jsonObject["data"] ?: throw ApiException(0, "Reply had no data field")

    /**
     * The payload of a reply whose `data` may legitimately be null - "no
     * workout in progress", "never trained this exercise". A missing `data`
     * key is still an error; `data: null` is an answer.
     */
    private fun JsonElement.optionalPayload(): JsonElement? =
        when (val data = jsonObject["data"] ?: throw ApiException(0, "Reply had no data field")) {
            is JsonNull -> null
            else -> data
        }

    private inline fun <reified T> JsonElement.decode(): T =
        client.json.decodeFromJsonElement(payload())

    private inline fun <reified T> JsonElement.decodeList(): List<T> =
        client.json.decodeFromJsonElement(payload())

    /** A @Serializable request body, as the JsonObject the client posts. */
    private inline fun <reified T> T.asJsonObject(): JsonObject =
        client.json.encodeToJsonElement(this).jsonObject
}
