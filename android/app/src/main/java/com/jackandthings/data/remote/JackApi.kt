package com.jackandthings.data.remote

import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.Note
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.PomodoroPresetDraft
import com.jackandthings.model.PomodoroSession
import com.jackandthings.model.PomodoroSessionDraft
import com.jackandthings.model.PomodoroStats
import com.jackandthings.model.RecurringTransaction
import com.jackandthings.model.ReminderState
import com.jackandthings.model.TokenPayload
import com.jackandthings.model.WatchList
import com.jackandthings.model.WatchListItem
import com.jackandthings.model.WorkoutEntry
import com.jackandthings.model.WorkoutPreset
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

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
     */
    suspend fun createTransaction(
        accountId: String,
        type: String,
        amount: String,
        description: String?,
    ): BudgetTransaction = client.post(
        "budget-transactions",
        buildJsonObject {
            put("account_id", accountId)
            put("type", type)
            put("amount", amount)
            put("description", description ?: "")
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

    private inline fun <reified T> JsonElement.decode(): T =
        client.json.decodeFromJsonElement(payload())

    private inline fun <reified T> JsonElement.decodeList(): List<T> =
        client.json.decodeFromJsonElement(payload())

    /** A @Serializable request body, as the JsonObject the client posts. */
    private inline fun <reified T> T.asJsonObject(): JsonObject =
        client.json.encodeToJsonElement(this).jsonObject
}
