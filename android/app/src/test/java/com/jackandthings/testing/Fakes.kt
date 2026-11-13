package com.jackandthings.testing

import com.jackandthings.model.AuthUser
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.Note
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.PomodoroPresetDraft
import com.jackandthings.model.PomodoroSession
import com.jackandthings.model.PomodoroSessionDraft
import com.jackandthings.model.PomodoroStats
import com.jackandthings.model.ReminderState
import com.jackandthings.model.WatchList
import com.jackandthings.model.WatchListItem
import com.jackandthings.model.WorkoutEntry
import com.jackandthings.model.WorkoutPreset
import com.jackandthings.repo.AuthStore
import com.jackandthings.repo.BudgetRepository
import com.jackandthings.repo.NotesRepository
import com.jackandthings.repo.PomodoroRepository
import com.jackandthings.repo.PomodoroSessionRepository
import com.jackandthings.repo.WatchListRepository
import com.jackandthings.repo.WorkoutRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Hand-written fakes rather than a mocking framework: they are short, they
 * read as the behaviour being set up, and they break loudly when an interface
 * changes.
 */

class FakeAuthStore : AuthStore {

    private val _signedIn = MutableStateFlow(false)
    override val signedIn: StateFlow<Boolean> = _signedIn.asStateFlow()

    private val _user = MutableStateFlow<AuthUser?>(null)
    override val user: StateFlow<AuthUser?> = _user.asStateFlow()

    /** Set to make the next sign-in fail the way bad credentials would. */
    var failure: Throwable? = null

    var restoreCalls: Int = 0
    var signOutCalls: Int = 0

    /** Every credential pair the screen submitted, in order. */
    val attempts: MutableList<Pair<String, String>> = mutableListOf()

    override fun restore() {
        restoreCalls++
    }

    override suspend fun signIn(email: String, password: String): Result<Unit> {
        attempts.add(email to password)
        failure?.let { return Result.failure(it) }

        _user.value = AuthUser(1, "Test User", email)
        _signedIn.value = true
        return Result.success(Unit)
    }

    override suspend fun signOut() {
        signOutCalls++
        _user.value = null
        _signedIn.value = false
    }

    override fun onUnauthenticated() {
        _user.value = null
        _signedIn.value = false
    }
}

class FakeNotesRepository(
    var notes: MutableList<Note> = mutableListOf(),
) : NotesRepository {

    var failure: Throwable? = null

    /** Every (title, body) pair the screen sent, in order. */
    val created: MutableList<Pair<String, String?>> = mutableListOf()
    val updated: MutableList<Triple<String, String, String?>> = mutableListOf()
    val starred: MutableList<Pair<String, Boolean>> = mutableListOf()
    val deletedIds: MutableList<String> = mutableListOf()

    override suspend fun list(): Result<List<Note>> =
        failure?.let { Result.failure(it) } ?: Result.success(notes.toList())

    override suspend fun create(title: String, body: String?): Result<Note> {
        failure?.let { return Result.failure(it) }

        created.add(title to body)
        val note = Note("note-${notes.size + 1}", title, body)
        notes.add(note)
        return Result.success(note)
    }

    override suspend fun update(id: String, title: String, body: String?): Result<Note> {
        failure?.let { return Result.failure(it) }

        updated.add(Triple(id, title, body))
        val note = Note(id, title, body)
        notes.replaceAll { if (it.id == id) note else it }
        return Result.success(note)
    }

    override suspend fun setStarred(id: String, isStarred: Boolean): Result<Note> {
        failure?.let { return Result.failure(it) }

        starred.add(id to isStarred)
        val note = notes.first { it.id == id }.copy(isStarred = isStarred)
        notes.replaceAll { if (it.id == id) note else it }
        return Result.success(note)
    }

    override suspend fun delete(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }

        deletedIds.add(id)
        notes.removeAll { it.id == id }
        return Result.success(Unit)
    }
}

class FakeWatchListRepository(
    var lists: MutableList<WatchList> = mutableListOf(),
) : WatchListRepository {

    var failure: Throwable? = null

    val createdLists: MutableList<String> = mutableListOf()
    val addedItems: MutableList<Triple<String, String, String?>> = mutableListOf()
    val toggledIds: MutableList<Pair<String, Boolean>> = mutableListOf()
    val deletedIds: MutableList<String> = mutableListOf()

    override suspend fun lists(): Result<List<WatchList>> =
        failure?.let { Result.failure(it) } ?: Result.success(lists.toList())

    override suspend fun createList(name: String): Result<WatchList> {
        failure?.let { return Result.failure(it) }

        createdLists.add(name)
        val list = WatchList("list-${lists.size + 1}", name)
        lists.add(list)
        return Result.success(list)
    }

    override suspend fun deleteList(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }

        deletedIds.add(id)
        lists.removeAll { it.id == id }
        return Result.success(Unit)
    }

    override suspend fun addItem(
        watchListId: String,
        title: String,
        note: String?,
    ): Result<WatchListItem> {
        failure?.let { return Result.failure(it) }

        addedItems.add(Triple(watchListId, title, note))
        return Result.success(WatchListItem("item-${addedItems.size}", watchListId, title, note))
    }

    override suspend fun updateItem(id: String, done: Boolean): Result<WatchListItem> {
        failure?.let { return Result.failure(it) }

        toggledIds.add(id to done)
        return Result.success(WatchListItem(id, title = "x", done = done))
    }

    override suspend fun deleteItem(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }

        deletedIds.add(id)
        return Result.success(Unit)
    }
}

class FakeWorkoutRepository(
    var entries: MutableList<WorkoutEntry> = mutableListOf(),
    var reminder: ReminderState = ReminderState(due = true, lastLoggedAt = null),
    var presets: MutableList<WorkoutPreset> = mutableListOf(),
) : WorkoutRepository {

    var failure: Throwable? = null

    /** Set separately: the banner must not break the list if it fails. */
    var reminderFailure: Throwable? = null

    val created: MutableList<Pair<String, String?>> = mutableListOf()
    val deletedIds: MutableList<String> = mutableListOf()

    override suspend fun list(): Result<List<WorkoutEntry>> =
        failure?.let { Result.failure(it) } ?: Result.success(entries.toList())

    override suspend fun reminderState(): Result<ReminderState> =
        reminderFailure?.let { Result.failure(it) } ?: Result.success(reminder)

    override suspend fun presets(): Result<List<WorkoutPreset>> =
        failure?.let { Result.failure(it) } ?: Result.success(presets.toList())

    override suspend fun create(
        activity: String,
        notes: String?,
        loggedAt: String?,
    ): Result<WorkoutEntry> {
        failure?.let { return Result.failure(it) }

        created.add(activity to notes)
        val entry = WorkoutEntry("w-${entries.size + 1}", activity, notes, loggedAt)
        entries.add(entry)
        // Logging something clears the nudge, the way the server would.
        reminder = ReminderState(due = false, lastLoggedAt = "now")
        return Result.success(entry)
    }

    override suspend fun delete(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }

        deletedIds.add(id)
        entries.removeAll { it.id == id }
        return Result.success(Unit)
    }
}

class FakePomodoroRepository(
    var presets: MutableList<PomodoroPreset> = mutableListOf(),
) : PomodoroRepository {

    /** Set to make the next call fail, the way a dead network would. */
    var failure: Throwable? = null

    var deletedIds: MutableList<String> = mutableListOf()

    override suspend fun list(): Result<List<PomodoroPreset>> =
        failure?.let { Result.failure(it) } ?: Result.success(presets.toList())

    override suspend fun create(draft: PomodoroPresetDraft): Result<PomodoroPreset> {
        failure?.let { return Result.failure(it) }

        val preset = draft.toPreset("id-${presets.size + 1}")
        presets.add(preset)
        return Result.success(preset)
    }

    override suspend fun update(id: String, draft: PomodoroPresetDraft): Result<PomodoroPreset> {
        failure?.let { return Result.failure(it) }

        val preset = draft.toPreset(id)
        presets.replaceAll { if (it.id == id) preset else it }
        return Result.success(preset)
    }

    override suspend fun delete(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }

        deletedIds.add(id)
        presets.removeAll { it.id == id }
        return Result.success(Unit)
    }
}

/**
 * Records what was asked of it and hands back a session with an id, so a test
 * can assert what the recorder posted without a server.
 */
class FakePomodoroSessionRepository(
    var sessions: MutableList<PomodoroSession> = mutableListOf(),
) : PomodoroSessionRepository {

    var failure: Throwable? = null

    var stats: PomodoroStats = PomodoroStats()

    var created: MutableList<PomodoroSessionDraft> = mutableListOf()

    var deletedIds: MutableList<String> = mutableListOf()

    override suspend fun list(limit: Int): Result<List<PomodoroSession>> =
        failure?.let { Result.failure(it) } ?: Result.success(sessions.toList())

    override suspend fun create(draft: PomodoroSessionDraft): Result<PomodoroSession> {
        failure?.let { return Result.failure(it) }

        created.add(draft)
        val session = PomodoroSession(
            id = "session-${sessions.size + 1}",
            presetId = draft.presetId,
            presetName = draft.presetName,
            tag = draft.tag,
            phase = draft.phase,
            startedAt = draft.startedAt,
            endedAt = draft.endedAt,
            durationSeconds = draft.durationSeconds,
            completed = draft.completed,
            source = draft.source,
        )
        sessions.add(session)
        return Result.success(session)
    }

    override suspend fun delete(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }

        deletedIds.add(id)
        sessions.removeAll { it.id == id }
        return Result.success(Unit)
    }

    override suspend fun stats(timezone: String): Result<PomodoroStats> =
        failure?.let { Result.failure(it) } ?: Result.success(stats.copy(timezone = timezone))
}

class FakeBudgetRepository(
    var accounts: MutableList<BudgetAccount> = mutableListOf(),
    var transactions: MutableList<BudgetTransaction> = mutableListOf(),
) : BudgetRepository {

    var accountsFailure: Throwable? = null
    var transactionsFailure: Throwable? = null
    var writeFailure: Throwable? = null

    /**
     * Lets account creation through but fails everything that depends on it,
     * which is the awkward half-done state a sync has to survive.
     */
    var failAfterAccounts: Boolean = false

    var postedAmounts: MutableList<String> = mutableListOf()

    /** Which account each post landed on, for checking id remapping. */
    var postedAccountIds: MutableList<String> = mutableListOf()
    var transfers: MutableList<Triple<String, String, String>> = mutableListOf()

    override suspend fun accounts(): Result<List<BudgetAccount>> =
        accountsFailure?.let { Result.failure(it) } ?: Result.success(accounts.toList())

    override suspend fun createAccount(name: String): Result<BudgetAccount> {
        writeFailure?.let { return Result.failure(it) }

        val account = BudgetAccount("acc-${accounts.size + 1}", name, 0)
        accounts.add(account)
        return Result.success(account)
    }

    override suspend fun deleteAccount(id: String): Result<Unit> {
        writeFailure?.let { return Result.failure(it) }

        accounts.removeAll { it.id == id }
        return Result.success(Unit)
    }

    override suspend fun transactions(): Result<List<BudgetTransaction>> =
        transactionsFailure?.let { Result.failure(it) } ?: Result.success(transactions.toList())

    override suspend fun post(
        accountId: String,
        type: String,
        amount: String,
        description: String?,
    ): Result<BudgetTransaction> {
        writeFailure?.let { return Result.failure(it) }
        if (failAfterAccounts) return Result.failure(RuntimeException("posting failed"))

        postedAmounts.add(amount)
        postedAccountIds.add(accountId)
        return Result.success(
            BudgetTransaction("tx-${postedAmounts.size}", type, 0, description),
        )
    }

    override suspend fun deleteTransaction(id: String): Result<Unit> {
        writeFailure?.let { return Result.failure(it) }

        transactions.removeAll { it.id == id }
        return Result.success(Unit)
    }

    override suspend fun transfer(
        fromAccountId: String,
        toAccountId: String,
        amount: String,
        description: String?,
    ): Result<Unit> {
        writeFailure?.let { return Result.failure(it) }
        if (failAfterAccounts) return Result.failure(RuntimeException("transfer failed"))

        transfers.add(Triple(fromAccountId, toAccountId, amount))
        return Result.success(Unit)
    }
}
