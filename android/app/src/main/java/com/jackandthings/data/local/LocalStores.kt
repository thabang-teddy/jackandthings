package com.jackandthings.data.local

import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.Note
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.WatchList
import com.jackandthings.model.WorkoutEntry
import java.io.File
import kotlinx.serialization.Serializable

/**
 * A transfer recorded while signed out. Kept separately from the two
 * transaction rows it produces (one per account) because those are only
 * display copies - this is what [com.jackandthings.repo.SyncManager] replays
 * as a single call once the account ids it refers to are known.
 */
@Serializable
data class PendingTransfer(
    val id: String,
    val fromAccountId: String,
    val toAccountId: String,
    val amountCents: Long,
    val description: String?,
)

/**
 * The on-device files that hold data created while signed out.
 *
 * Nothing reads them once a session is signed in except
 * [com.jackandthings.repo.SyncManager]: the switching repositories (see
 * `SwitchingRepositories.kt`) read the server directly at that point, so this
 * is purely a staging area for the backlog between offline use and sign-in.
 */
class LocalStores(private val dir: File) {

    val notes = JsonFileStore(File(dir, "local_notes.json"), Note.serializer())
    val presets = JsonFileStore(File(dir, "local_presets.json"), PomodoroPreset.serializer())
    val workoutEntries =
        JsonFileStore(File(dir, "local_workout_entries.json"), WorkoutEntry.serializer())
    val budgetAccounts =
        JsonFileStore(File(dir, "local_budget_accounts.json"), BudgetAccount.serializer())
    val budgetTransactions =
        JsonFileStore(File(dir, "local_budget_transactions.json"), BudgetTransaction.serializer())
    val pendingTransfers =
        JsonFileStore(File(dir, "local_pending_transfers.json"), PendingTransfer.serializer())
    val watchLists = JsonFileStore(File(dir, "local_watch_lists.json"), WatchList.serializer())

    suspend fun hasPendingData(): Boolean =
        notes.read().isNotEmpty() ||
            presets.read().isNotEmpty() ||
            workoutEntries.read().isNotEmpty() ||
            budgetAccounts.read().isNotEmpty() ||
            budgetTransactions.read().isNotEmpty() ||
            watchLists.read().isNotEmpty()
}
