package com.jackandthings.repo

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

/**
 * Thin switches between a module's local and remote repository, one per
 * module, all following the same shape: read [AuthStore.signedIn] on every
 * call rather than once, so a sign-in or sign-out mid-session redirects the
 * very next call without the screen needing to be recreated.
 */

class SwitchingNotesRepository(
    private val auth: AuthStore,
    private val local: NotesRepository,
    private val remote: NotesRepository,
) : NotesRepository {
    private val active: NotesRepository get() = if (auth.signedIn.value) remote else local

    override suspend fun list(): Result<List<Note>> = active.list()
    override suspend fun create(title: String, body: String?) = active.create(title, body)
    override suspend fun update(id: String, title: String, body: String?) = active.update(id, title, body)
    override suspend fun setStarred(id: String, isStarred: Boolean) = active.setStarred(id, isStarred)
    override suspend fun delete(id: String) = active.delete(id)
}

class SwitchingPomodoroRepository(
    private val auth: AuthStore,
    private val local: PomodoroRepository,
    private val remote: PomodoroRepository,
) : PomodoroRepository {
    private val active: PomodoroRepository get() = if (auth.signedIn.value) remote else local

    override suspend fun list(): Result<List<PomodoroPreset>> = active.list()
    override suspend fun create(draft: PomodoroPresetDraft) = active.create(draft)
    override suspend fun update(id: String, draft: PomodoroPresetDraft) = active.update(id, draft)
    override suspend fun delete(id: String) = active.delete(id)
}

class SwitchingWorkoutRepository(
    private val auth: AuthStore,
    private val local: WorkoutRepository,
    private val remote: WorkoutRepository,
) : WorkoutRepository {
    private val active: WorkoutRepository get() = if (auth.signedIn.value) remote else local

    override suspend fun list(): Result<List<WorkoutEntry>> = active.list()
    override suspend fun reminderState(): Result<ReminderState> = active.reminderState()
    override suspend fun presets(): Result<List<WorkoutPreset>> = active.presets()
    override suspend fun create(activity: String, notes: String?, loggedAt: String?) =
        active.create(activity, notes, loggedAt)
    override suspend fun delete(id: String) = active.delete(id)
}

class SwitchingWatchListRepository(
    private val auth: AuthStore,
    private val local: WatchListRepository,
    private val remote: WatchListRepository,
) : WatchListRepository {
    private val active: WatchListRepository get() = if (auth.signedIn.value) remote else local

    override suspend fun lists(): Result<List<WatchList>> = active.lists()
    override suspend fun createList(name: String) = active.createList(name)
    override suspend fun deleteList(id: String) = active.deleteList(id)
    override suspend fun addItem(watchListId: String, title: String, note: String?) =
        active.addItem(watchListId, title, note)
    override suspend fun updateItem(id: String, done: Boolean): Result<WatchListItem> =
        active.updateItem(id, done)
    override suspend fun deleteItem(id: String) = active.deleteItem(id)
}

class SwitchingBudgetRepository(
    private val auth: AuthStore,
    private val local: BudgetRepository,
    private val remote: BudgetRepository,
) : BudgetRepository {
    private val active: BudgetRepository get() = if (auth.signedIn.value) remote else local

    override suspend fun accounts(): Result<List<BudgetAccount>> = active.accounts()
    override suspend fun createAccount(name: String) = active.createAccount(name)
    override suspend fun deleteAccount(id: String) = active.deleteAccount(id)
    override suspend fun transactions(): Result<List<BudgetTransaction>> = active.transactions()
    override suspend fun postTransaction(draft: BudgetTransactionDraft) =
        active.postTransaction(draft)
    override suspend fun deleteTransaction(id: String) = active.deleteTransaction(id)
    override suspend fun transfer(
        fromAccountId: String,
        toAccountId: String,
        amount: String,
        description: String?,
    ) = active.transfer(fromAccountId, toAccountId, amount, description)

    // These have no signed-out half; the interface default says so. Routing
    // them through `active` keeps one switch rule for the whole module rather
    // than five special cases in the ViewModel.
    override suspend fun categories(): Result<List<BudgetCategory>> = active.categories()
    override suspend fun createCategory(name: String, kind: String) = active.createCategory(name, kind)
    override suspend fun updateCategory(id: String, name: String, kind: String) =
        active.updateCategory(id, name, kind)
    override suspend fun deleteCategory(id: String) = active.deleteCategory(id)
    override suspend fun limits(period: String): Result<List<BudgetLimitState>> = active.limits(period)
    override suspend fun saveLimit(categoryId: String, period: String, limit: String) =
        active.saveLimit(categoryId, period, limit)
    override suspend fun deleteLimit(id: String) = active.deleteLimit(id)
    override suspend fun goals(): Result<List<BudgetGoal>> = active.goals()
    override suspend fun createGoal(draft: BudgetGoalDraft) = active.createGoal(draft)
    override suspend fun updateGoal(id: String, draft: BudgetGoalDraft) = active.updateGoal(id, draft)
    override suspend fun deleteGoal(id: String) = active.deleteGoal(id)
    override suspend fun report(period: String, months: Int): Result<BudgetReport> =
        active.report(period, months)
    override suspend fun due(period: String): Result<BudgetDue> = active.due(period)
    override suspend fun uploadReceipt(
        transactionId: String,
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
    ) = active.uploadReceipt(transactionId, bytes, fileName, mimeType)
    override suspend fun deleteReceipt(id: String) = active.deleteReceipt(id)
}
