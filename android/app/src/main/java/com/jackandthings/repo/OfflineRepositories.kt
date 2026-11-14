package com.jackandthings.repo

import com.jackandthings.data.local.OfflineCache
import com.jackandthings.data.local.Outbox
import com.jackandthings.data.local.PendingAction
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetCategory
import com.jackandthings.model.BudgetDue
import com.jackandthings.model.BudgetGoal
import com.jackandthings.model.BudgetGoalDraft
import com.jackandthings.model.BudgetLimitState
import com.jackandthings.model.BudgetReceipt
import com.jackandthings.model.BudgetReport
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.BudgetTransactionDraft
import com.jackandthings.model.Note
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.PomodoroPresetDraft
import com.jackandthings.model.ReminderState
import com.jackandthings.model.WatchList
import com.jackandthings.model.WatchListItem
import com.jackandthings.model.WorkoutEntry
import com.jackandthings.model.WorkoutPreset
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * The signed-in half of offline support, one decorator per module.
 *
 * Each wraps the API-backed repository and does two things when the server
 * cannot be reached: serve the last list it saw ([OfflineCache]), and record
 * the write so it can be replayed later ([Outbox]). A refusal the server
 * actually sent is passed straight through - see [isOffline].
 *
 * Writes made offline report success and patch the cache, so the screen
 * shows the change immediately. The new row carries a local id until
 * [OutboxDrainer] swaps the real one in.
 *
 * Signed-out use is unchanged and still goes to the local stores through
 * SwitchingRepositories.kt; this layer sits on the remote side of that
 * switch, so it only ever runs for a signed-in session.
 */

class OfflineNotesRepository(
    private val remote: NotesRepository,
    private val cache: OfflineCache,
    private val outbox: Outbox,
) : NotesRepository {

    override suspend fun list(): Result<List<Note>> =
        readThroughCache(cache.notes) { remote.list() }

    override suspend fun create(title: String, body: String?): Result<Note> =
        orWhenOffline(remote.create(title, body)) {
            val note = Note(id = PendingAction.newId(), title = title, body = body)
            outbox.add(PendingAction.CreateNote(subjectId = note.id, title = title, body = body))
            cache.notes.write(listOf(note) + cache.notes.read())
            Result.success(note)
        }

    override suspend fun update(id: String, title: String, body: String?): Result<Note> =
        orWhenOffline(remote.update(id, title, body)) {
            outbox.add(PendingAction.UpdateNote(subjectId = id, title = title, body = body))
            val updated = cachedNote(id).copy(title = title, body = body)
            writeNote(updated)
            Result.success(updated)
        }

    override suspend fun setStarred(id: String, isStarred: Boolean): Result<Note> =
        orWhenOffline(remote.setStarred(id, isStarred)) {
            outbox.add(PendingAction.StarNote(subjectId = id, isStarred = isStarred))
            val updated = cachedNote(id).copy(isStarred = isStarred)
            writeNote(updated)
            Result.success(updated)
        }

    override suspend fun delete(id: String): Result<Unit> =
        orWhenOffline(remote.delete(id)) {
            outbox.add(PendingAction.DeleteNote(subjectId = id))
            cache.notes.write(cache.notes.read().filterNot { it.id == id })
            Result.success(Unit)
        }

    private suspend fun cachedNote(id: String): Note =
        cache.notes.read().firstOrNull { it.id == id } ?: Note(id = id, title = "")

    private suspend fun writeNote(note: Note) =
        cache.notes.write(cache.notes.read().map { if (it.id == note.id) note else it })
}

class OfflinePomodoroRepository(
    private val remote: PomodoroRepository,
    private val cache: OfflineCache,
    private val outbox: Outbox,
) : PomodoroRepository {

    override suspend fun list(): Result<List<PomodoroPreset>> =
        readThroughCache(cache.presets) { remote.list() }

    override suspend fun create(draft: PomodoroPresetDraft): Result<PomodoroPreset> =
        orWhenOffline(remote.create(draft)) {
            val preset = draft.toPreset(PendingAction.newId())
            outbox.add(PendingAction.CreatePreset(subjectId = preset.id, draft = draft))
            cache.presets.write(cache.presets.read() + preset)
            Result.success(preset)
        }

    override suspend fun update(id: String, draft: PomodoroPresetDraft): Result<PomodoroPreset> =
        orWhenOffline(remote.update(id, draft)) {
            val preset = draft.toPreset(id)
            outbox.add(PendingAction.UpdatePreset(subjectId = id, draft = draft))
            cache.presets.write(cache.presets.read().map { if (it.id == id) preset else it })
            Result.success(preset)
        }

    override suspend fun delete(id: String): Result<Unit> =
        orWhenOffline(remote.delete(id)) {
            outbox.add(PendingAction.DeletePreset(subjectId = id))
            cache.presets.write(cache.presets.read().filterNot { it.id == id })
            Result.success(Unit)
        }
}

class OfflineWorkoutRepository(
    private val remote: WorkoutRepository,
    private val cache: OfflineCache,
    private val outbox: Outbox,
) : WorkoutRepository {

    override suspend fun list(): Result<List<WorkoutEntry>> =
        readThroughCache(cache.workoutEntries) { remote.list() }

    override suspend fun presets(): Result<List<WorkoutPreset>> =
        readThroughCache(cache.workoutPresets) { remote.presets() }

    /**
     * Answered from the cached entries when the server is unreachable, by the
     * same "anything logged this clock hour" rule the server applies, so the
     * banner and the reminder worker still say something truthful rather than
     * failing shut.
     */
    override suspend fun reminderState(): Result<ReminderState> =
        orWhenOffline(remote.reminderState()) {
            val startOfHour = Instant.now()
                .atZone(ZoneOffset.UTC)
                .withMinute(0)
                .withSecond(0)
                .withNano(0)
                .toInstant()

            val logged = cache.workoutEntries.read().mapNotNull { entry ->
                entry.loggedAt?.let { raw ->
                    runCatching { Instant.parse(raw) }.getOrNull()?.let { it to raw }
                }
            }

            Result.success(
                ReminderState(
                    due = logged.none { (loggedAt, _) -> !loggedAt.isBefore(startOfHour) },
                    lastLoggedAt = logged.maxByOrNull { (loggedAt, _) -> loggedAt }?.second,
                ),
            )
        }

    override suspend fun create(
        activity: String,
        notes: String?,
        loggedAt: String?,
    ): Result<WorkoutEntry> =
        orWhenOffline(remote.create(activity, notes, loggedAt)) {
            // Stamped now and carried through the queue, so a workout logged
            // on a dead connection keeps the time it actually happened rather
            // than the time the queue drained.
            val happenedAt = loggedAt ?: Instant.now().toString()
            val entry = WorkoutEntry(
                id = PendingAction.newId(),
                activity = activity,
                notes = notes,
                loggedAt = happenedAt,
            )
            outbox.add(
                PendingAction.CreateWorkout(
                    subjectId = entry.id,
                    activity = activity,
                    notes = notes,
                    loggedAt = happenedAt,
                ),
            )
            cache.workoutEntries.write(listOf(entry) + cache.workoutEntries.read())
            Result.success(entry)
        }

    override suspend fun delete(id: String): Result<Unit> =
        orWhenOffline(remote.delete(id)) {
            outbox.add(PendingAction.DeleteWorkout(subjectId = id))
            cache.workoutEntries.write(cache.workoutEntries.read().filterNot { it.id == id })
            Result.success(Unit)
        }
}

class OfflineWatchListRepository(
    private val remote: WatchListRepository,
    private val cache: OfflineCache,
    private val outbox: Outbox,
) : WatchListRepository {

    override suspend fun lists(): Result<List<WatchList>> =
        readThroughCache(cache.watchLists) { remote.lists() }

    override suspend fun createList(name: String): Result<WatchList> =
        orWhenOffline(remote.createList(name)) {
            val list = WatchList(id = PendingAction.newId(), name = name)
            outbox.add(PendingAction.CreateWatchList(subjectId = list.id, name = name))
            cache.watchLists.write(cache.watchLists.read() + list)
            Result.success(list)
        }

    override suspend fun deleteList(id: String): Result<Unit> =
        orWhenOffline(remote.deleteList(id)) {
            outbox.add(PendingAction.DeleteWatchList(subjectId = id))
            cache.watchLists.write(cache.watchLists.read().filterNot { it.id == id })
            Result.success(Unit)
        }

    override suspend fun addItem(
        watchListId: String,
        title: String,
        note: String?,
    ): Result<WatchListItem> =
        orWhenOffline(remote.addItem(watchListId, title, note)) {
            val item = WatchListItem(
                id = PendingAction.newId(),
                watchListId = watchListId,
                title = title,
                note = note,
            )
            outbox.add(
                PendingAction.CreateWatchListItem(
                    subjectId = item.id,
                    watchListId = watchListId,
                    title = title,
                    note = note,
                ),
            )
            mapLists { list ->
                if (list.id == watchListId) list.copy(items = list.items + item) else list
            }
            Result.success(item)
        }

    override suspend fun updateItem(id: String, done: Boolean): Result<WatchListItem> =
        orWhenOffline(remote.updateItem(id, done)) {
            outbox.add(PendingAction.UpdateWatchListItem(subjectId = id, done = done))

            val updated = cache.watchLists.read()
                .flatMap { it.items }
                .firstOrNull { it.id == id }
                ?.copy(done = done)
                ?: WatchListItem(id = id, title = "", done = done)

            mapLists { list ->
                list.copy(items = list.items.map { if (it.id == id) updated else it })
            }
            Result.success(updated)
        }

    override suspend fun deleteItem(id: String): Result<Unit> =
        orWhenOffline(remote.deleteItem(id)) {
            outbox.add(PendingAction.DeleteWatchListItem(subjectId = id))
            mapLists { list -> list.copy(items = list.items.filterNot { it.id == id }) }
            Result.success(Unit)
        }

    private suspend fun mapLists(transform: (WatchList) -> WatchList) =
        cache.watchLists.write(cache.watchLists.read().map(transform))
}

class OfflineBudgetRepository(
    private val remote: BudgetRepository,
    private val cache: OfflineCache,
    private val outbox: Outbox,
) : BudgetRepository {

    override suspend fun accounts(): Result<List<BudgetAccount>> =
        readThroughCache(cache.budgetAccounts) { remote.accounts() }

    override suspend fun transactions(): Result<List<BudgetTransaction>> =
        readThroughCache(cache.budgetTransactions) { remote.transactions() }

    override suspend fun createAccount(name: String): Result<BudgetAccount> =
        orWhenOffline(remote.createAccount(name)) {
            val account = BudgetAccount(id = PendingAction.newId(), name = name)
            outbox.add(PendingAction.CreateAccount(subjectId = account.id, name = name))
            cache.budgetAccounts.write(cache.budgetAccounts.read() + account)
            Result.success(account)
        }

    override suspend fun deleteAccount(id: String): Result<Unit> =
        orWhenOffline(remote.deleteAccount(id)) {
            outbox.add(PendingAction.DeleteAccount(subjectId = id))
            cache.budgetAccounts.write(cache.budgetAccounts.read().filterNot { it.id == id })
            Result.success(Unit)
        }

    override suspend fun postTransaction(
        draft: BudgetTransactionDraft,
    ): Result<BudgetTransaction> =
        orWhenOffline(remote.postTransaction(draft)) {
            val cents = draft.amount.amountStringToCentsOrNull()
                ?: return@orWhenOffline Result.failure(
                    IllegalArgumentException("That is not a valid amount: ${draft.amount}"),
                )

            val category = draft.categoryId?.let { id ->
                cache.budgetCategories.read().firstOrNull { it.id == id }
            }
            val transaction = BudgetTransaction(
                id = PendingAction.newId(),
                type = draft.type,
                amountCents = cents,
                description = draft.description,
                accountId = draft.accountId,
                account = accountName(draft.accountId),
                categoryId = draft.categoryId,
                category = category?.name,
                occurredOn = draft.occurredOn ?: LocalDate.now().toString(),
                merchant = draft.merchant,
                createdAt = Instant.now().toString(),
            )
            outbox.add(
                PendingAction.PostTransaction(
                    subjectId = transaction.id,
                    accountId = draft.accountId,
                    type = draft.type,
                    amount = draft.amount,
                    description = draft.description,
                    occurredOn = draft.occurredOn,
                    merchant = draft.merchant,
                    categoryId = draft.categoryId,
                ),
            )
            cache.budgetTransactions.write(listOf(transaction) + cache.budgetTransactions.read())
            adjustBalance(draft.accountId, if (transaction.isCredit) cents else -cents)
            Result.success(transaction)
        }

    override suspend fun deleteTransaction(id: String): Result<Unit> =
        orWhenOffline(remote.deleteTransaction(id)) {
            outbox.add(PendingAction.DeleteTransaction(subjectId = id))
            cache.budgetTransactions.write(cache.budgetTransactions.read().filterNot { it.id == id })
            Result.success(Unit)
        }

    /**
     * Both legs are written to the cache, as the server would, so the two
     * accounts read correctly until the real rows arrive.
     */
    override suspend fun transfer(
        fromAccountId: String,
        toAccountId: String,
        amount: String,
        description: String?,
    ): Result<Unit> =
        orWhenOffline(remote.transfer(fromAccountId, toAccountId, amount, description)) {
            val cents = amount.amountStringToCentsOrNull()
                ?: return@orWhenOffline Result.failure(
                    IllegalArgumentException("That is not a valid amount: $amount"),
                )

            outbox.add(
                PendingAction.Transfer(
                    subjectId = PendingAction.newId(),
                    fromAccountId = fromAccountId,
                    toAccountId = toAccountId,
                    amount = amount,
                    description = description,
                ),
            )

            val now = Instant.now().toString()
            val today = LocalDate.now().toString()
            val out = BudgetTransaction(
                id = PendingAction.newId(),
                type = "transfer_out",
                amountCents = cents,
                description = description,
                accountId = fromAccountId,
                account = accountName(fromAccountId),
                relatedAccountId = toAccountId,
                relatedAccount = accountName(toAccountId),
                occurredOn = today,
                createdAt = now,
            )
            val into = out.copy(
                id = PendingAction.newId(),
                type = "transfer_in",
                accountId = toAccountId,
                account = accountName(toAccountId),
                relatedAccountId = fromAccountId,
                relatedAccount = accountName(fromAccountId),
            )

            cache.budgetTransactions.write(listOf(into, out) + cache.budgetTransactions.read())
            adjustBalance(fromAccountId, -cents)
            adjustBalance(toAccountId, cents)
            Result.success(Unit)
        }

    /*
     * Categories and goals are read through the cache because they are
     * slow-moving lists a signed-in screen re-reads on every visit; limits,
     * reports and due state are period-specific and are fetched fresh so a
     * stale month is never shown as if it were the current one. Receipt
     * uploads are multipart and are never queued offline.
     */

    override suspend fun categories(): Result<List<BudgetCategory>> =
        readThroughCache(cache.budgetCategories) { remote.categories() }

    override suspend fun createCategory(name: String, kind: String): Result<BudgetCategory> =
        remote.createCategory(name, kind).also { result ->
            result.getOrNull()?.let { created ->
                cache.budgetCategories.write(cache.budgetCategories.read() + created)
            }
        }

    override suspend fun updateCategory(
        id: String,
        name: String,
        kind: String,
    ): Result<BudgetCategory> = remote.updateCategory(id, name, kind).also { result ->
        result.getOrNull()?.let { updated ->
            cache.budgetCategories.write(
                cache.budgetCategories.read().map { if (it.id == id) updated else it },
            )
        }
    }

    override suspend fun deleteCategory(id: String): Result<Unit> =
        remote.deleteCategory(id).also { result ->
            if (result.isSuccess) {
                cache.budgetCategories.write(
                    cache.budgetCategories.read().filterNot { it.id == id },
                )
            }
        }

    override suspend fun limits(period: String): Result<List<BudgetLimitState>> =
        remote.limits(period)

    override suspend fun saveLimit(
        categoryId: String,
        period: String,
        limit: String,
    ): Result<BudgetLimitState> = remote.saveLimit(categoryId, period, limit)

    override suspend fun deleteLimit(id: String): Result<Unit> = remote.deleteLimit(id)

    override suspend fun goals(): Result<List<BudgetGoal>> =
        readThroughCache(cache.budgetGoals) { remote.goals() }

    override suspend fun createGoal(draft: BudgetGoalDraft): Result<BudgetGoal> =
        remote.createGoal(draft).also { result ->
            result.getOrNull()?.let { created ->
                cache.budgetGoals.write(cache.budgetGoals.read() + created)
            }
        }

    override suspend fun updateGoal(id: String, draft: BudgetGoalDraft): Result<BudgetGoal> =
        remote.updateGoal(id, draft).also { result ->
            result.getOrNull()?.let { updated ->
                cache.budgetGoals.write(
                    cache.budgetGoals.read().map { if (it.id == id) updated else it },
                )
            }
        }

    override suspend fun deleteGoal(id: String): Result<Unit> =
        remote.deleteGoal(id).also { result ->
            if (result.isSuccess) {
                cache.budgetGoals.write(cache.budgetGoals.read().filterNot { it.id == id })
            }
        }

    override suspend fun report(period: String, months: Int): Result<BudgetReport> =
        remote.report(period, months)

    override suspend fun due(period: String): Result<BudgetDue> = remote.due(period)

    override suspend fun uploadReceipt(
        transactionId: String,
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
    ): Result<BudgetReceipt> =
        remote.uploadReceipt(transactionId, bytes, fileName, mimeType)

    override suspend fun deleteReceipt(id: String): Result<Unit> = remote.deleteReceipt(id)

    private suspend fun accountName(id: String): String? =
        cache.budgetAccounts.read().firstOrNull { it.id == id }?.name

    private suspend fun adjustBalance(accountId: String, delta: Long) =
        cache.budgetAccounts.write(
            cache.budgetAccounts.read().map { account ->
                if (account.id == accountId) {
                    account.copy(balanceCents = account.balanceCents + delta)
                } else {
                    account
                }
            },
        )
}
