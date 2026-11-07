package com.jackandthings.data.remote

import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.ClipboardItem
import com.jackandthings.model.Note
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.ReminderState
import com.jackandthings.model.TokenPayload
import com.jackandthings.model.WorkoutEntry
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
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

    suspend fun deleteNote(id: String) = client.delete("notes/$id")

    private fun noteBody(title: String, body: String?) = buildJsonObject {
        put("title", title)
        put("body", body ?: "")
    }

    // ── Pomodoro ───────────────────────────────────────────────────────────

    suspend fun presets(): List<PomodoroPreset> = client.get("pomodoro-presets").decodeList()

    suspend fun createPreset(name: String, focusMinutes: Int, breakMinutes: Int): PomodoroPreset =
        client.post(
            "pomodoro-presets",
            buildJsonObject {
                put("name", name)
                put("focus_minutes", focusMinutes)
                put("break_minutes", breakMinutes)
            },
        ).decode()

    suspend fun deletePreset(id: String) = client.delete("pomodoro-presets/$id")

    // ── Clipboard ──────────────────────────────────────────────────────────

    suspend fun clipboardItems(): List<ClipboardItem> =
        client.get("clipboard-items").decodeList()

    suspend fun createClipboardItem(
        title: String?,
        content: String,
        sourceDevice: String?,
    ): ClipboardItem = client.post(
        "clipboard-items",
        buildJsonObject {
            put("title", title ?: "")
            put("content", content)
            sourceDevice?.let { put("source_device", it) }
        },
    ).decode()

    suspend fun deleteClipboardItem(id: String) = client.delete("clipboard-items/$id")

    // ── Workout ────────────────────────────────────────────────────────────

    suspend fun workoutEntries(): List<WorkoutEntry> =
        client.get("workout-entries").decodeList()

    /** Reminder state for this device to act on; the server sends nothing. */
    suspend fun reminderState(): ReminderState = client.get("workout-entries/due").decode()

    suspend fun createWorkoutEntry(activity: String, notes: String?): WorkoutEntry =
        client.post(
            "workout-entries",
            buildJsonObject {
                put("activity", activity)
                put("notes", notes ?: "")
            },
        ).decode()

    suspend fun deleteWorkoutEntry(id: String) = client.delete("workout-entries/$id")

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

    // ── Decoding ───────────────────────────────────────────────────────────

    /** Every reply wraps its payload in `data`. */
    private fun JsonElement.payload(): JsonElement =
        jsonObject["data"] ?: throw ApiException(0, "Reply had no data field")

    private inline fun <reified T> JsonElement.decode(): T =
        client.json.decodeFromJsonElement(payload())

    private inline fun <reified T> JsonElement.decodeList(): List<T> =
        client.json.decodeFromJsonElement(payload())
}
