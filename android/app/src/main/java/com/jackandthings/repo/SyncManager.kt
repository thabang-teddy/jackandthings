package com.jackandthings.repo

import com.jackandthings.data.local.LocalStores
import com.jackandthings.data.local.PendingTransfer
import com.jackandthings.model.AccountRef
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.Note
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.WatchList
import com.jackandthings.model.WatchListItem
import com.jackandthings.model.WorkoutEntry

/** What a sync attempt did, for the dialog that reports it. */
data class SyncResult(val pushed: Int, val errors: List<String>) {
    val success: Boolean get() = errors.isEmpty()
}

/**
 * Pushes data created while signed out up to the server, then clears what
 * made it there. Anything that fails stays local for the next attempt.
 *
 * Budget accounts are pushed first since transactions and transfers refer to
 * them: once an account is confirmed remotely, every local reference to its
 * old local id is rewritten to the real server id before the account row
 * itself is dropped, so a transaction that fails to push can still be
 * retried later without its account needing to exist locally any more.
 */
class SyncManager(
    private val stores: LocalStores,
    private val remoteNotes: NotesRepository,
    private val remotePomodoro: PomodoroRepository,
    private val remoteWorkout: WorkoutRepository,
    private val remoteBudget: BudgetRepository,
    private val remoteWatchList: WatchListRepository,
) {
    suspend fun hasPendingData(): Boolean = stores.hasPendingData()

    suspend fun sync(): SyncResult {
        val errors = mutableListOf<String>()
        var pushed = 0

        pushed += syncNotes(errors)
        pushed += syncPresets(errors)
        pushed += syncWorkoutEntries(errors)
        pushed += syncWatchLists(errors)
        pushed += syncBudget(errors)

        return SyncResult(pushed, errors)
    }

    private suspend fun syncNotes(errors: MutableList<String>): Int {
        val remaining = mutableListOf<Note>()
        var pushed = 0
        for (note in stores.notes.read()) {
            remoteNotes.create(note.title, note.body)
                .onSuccess { created ->
                    pushed++
                    // create() does not carry the flag, so a note starred
                    // while signed out is pinned in a second call rather than
                    // quietly losing its star on the way up.
                    if (note.isStarred) {
                        remoteNotes.setStarred(created.id, true).onFailure {
                            errors += "Note \"${note.title}\" synced but could not be starred"
                        }
                    }
                }
                .onFailure {
                    remaining += note
                    errors += "Note \"${note.title}\": ${it.readableMessage()}"
                }
        }
        stores.notes.write(remaining)
        return pushed
    }

    private suspend fun syncPresets(errors: MutableList<String>): Int {
        val remaining = mutableListOf<PomodoroPreset>()
        var pushed = 0
        for (preset in stores.presets.read()) {
            // The whole preset, not just its minutes: a local preset carries
            // its sounds, tag and strict-mode blocklist too, and a sync that
            // dropped those would quietly reset them on sign-in.
            remotePomodoro.create(preset.toDraft())
                .onSuccess { pushed++ }
                .onFailure {
                    remaining += preset
                    errors += "Preset \"${preset.name}\": ${it.readableMessage()}"
                }
        }
        stores.presets.write(remaining)
        return pushed
    }

    private suspend fun syncWorkoutEntries(errors: MutableList<String>): Int {
        val remaining = mutableListOf<WorkoutEntry>()
        var pushed = 0
        for (entry in stores.workoutEntries.read()) {
            // The local row already knows when it happened; without passing
            // it the server would stamp the entry with the sign-in time.
            remoteWorkout.create(entry.activity, entry.notes, entry.loggedAt)
                .onSuccess { pushed++ }
                .onFailure {
                    remaining += entry
                    errors += "Workout \"${entry.activity}\": ${it.readableMessage()}"
                }
        }
        stores.workoutEntries.write(remaining)
        return pushed
    }

    /** Lists are pushed whole; only items that fail to join them stay local. */
    private suspend fun syncWatchLists(errors: MutableList<String>): Int {
        val remaining = mutableListOf<WatchList>()
        var pushed = 0

        for (list in stores.watchLists.read()) {
            val created = remoteWatchList.createList(list.name).getOrNull()
            if (created == null) {
                remaining += list
                errors += "Watch list \"${list.name}\" could not be created"
                continue
            }
            pushed++

            val remainingItems = mutableListOf<WatchListItem>()
            for (item in list.items) {
                val createdItem = remoteWatchList.addItem(created.id, item.title, item.note).getOrNull()
                if (createdItem == null) {
                    remainingItems += item
                    errors += "Watch list item \"${item.title}\" could not be created"
                    continue
                }
                pushed++

                if (item.done) {
                    remoteWatchList.updateItem(createdItem.id, done = true).onFailure {
                        errors += "Could not mark \"${item.title}\" done: ${it.readableMessage()}"
                    }
                }
            }

            if (remainingItems.isNotEmpty()) {
                // The list itself is already on the server, so its leftover
                // items now travel under the real id rather than the old one.
                remaining += list.copy(id = created.id, items = remainingItems)
            }
        }

        stores.watchLists.write(remaining)
        return pushed
    }

    private suspend fun syncBudget(errors: MutableList<String>): Int {
        var pushed = 0
        val idMap = mutableMapOf<String, String>()

        val remainingAccounts = mutableListOf<BudgetAccount>()
        for (account in stores.budgetAccounts.read()) {
            remoteBudget.createAccount(account.name).fold(
                onSuccess = { created -> idMap[account.id] = created.id; pushed++ },
                onFailure = {
                    remainingAccounts += account
                    errors += "Account \"${account.name}\": ${it.readableMessage()}"
                },
            )
        }
        stores.budgetAccounts.write(remainingAccounts)

        fun remap(ref: AccountRef?): AccountRef? =
            ref?.let { r -> idMap[r.id]?.let { serverId -> r.copy(id = serverId) } ?: r }

        val remainingTransactions = mutableListOf<BudgetTransaction>()
        for (txn in stores.budgetTransactions.read()) {
            // Transfer legs are display copies of a pending transfer, not
            // transactions in their own right, so they are never pushed here.
            if (txn.type == "transfer_in" || txn.type == "transfer_out") continue

            val account = remap(txn.account)
            if (account == null) {
                remainingTransactions += txn
                errors += "A transaction's account was never synced"
                continue
            }

            remoteBudget.post(account.id, txn.type, txn.amountCents.centsToAmountString(), txn.description)
                .onSuccess { pushed++ }
                .onFailure {
                    remainingTransactions += txn.copy(account = account)
                    errors += "Transaction \"${txn.description ?: txn.label}\": ${it.readableMessage()}"
                }
        }
        stores.budgetTransactions.write(remainingTransactions)

        val remainingTransfers = mutableListOf<PendingTransfer>()
        for (transfer in stores.pendingTransfers.read()) {
            val fromId = idMap[transfer.fromAccountId] ?: transfer.fromAccountId
            val toId = idMap[transfer.toAccountId] ?: transfer.toAccountId

            remoteBudget.transfer(fromId, toId, transfer.amountCents.centsToAmountString(), transfer.description)
                .onSuccess { pushed++ }
                .onFailure {
                    remainingTransfers += transfer.copy(fromAccountId = fromId, toAccountId = toId)
                    errors += "Transfer: ${it.readableMessage()}"
                }
        }
        stores.pendingTransfers.write(remainingTransfers)

        return pushed
    }
}
