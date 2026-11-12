package com.jackandthings.repo

import com.jackandthings.data.local.OfflineCache
import com.jackandthings.data.local.Outbox
import com.jackandthings.data.local.PendingAction

/** What a drain attempt did, for the banner that reports it. */
data class DrainResult(val pushed: Int, val failed: Int, val stillPending: Int) {
    val didWork: Boolean get() = pushed > 0 || failed > 0
}

/**
 * Replays the writes made while the server was unreachable, oldest first.
 *
 * Two rules hold the whole thing together:
 *
 * 1. **Order is preserved and a drain stops at the first unreachable server.**
 *    "Create a list, add an item to it" is only correct in sequence, so a
 *    drain that kept going past a failure could add an item to a list the
 *    server does not have yet.
 *
 * 2. **Local ids are remapped as real ones arrive.** A row created offline
 *    was given a local UUID, and the actions queued after it refer to that
 *    id. Once the create succeeds, [idMap] rewrites every later reference,
 *    the same trick SyncManager already uses for budget accounts.
 *
 * An action the server actively refuses (a 422, or a row somebody deleted
 * elsewhere) is dropped rather than retried forever: it would fail the same
 * way on every future attempt and block everything queued behind it. The
 * reason is reported so it is not lost silently.
 */
class OutboxDrainer(
    private val outbox: Outbox,
    private val cache: OfflineCache,
    private val notes: NotesRepository,
    private val pomodoro: PomodoroRepository,
    private val workout: WorkoutRepository,
    private val watchList: WatchListRepository,
    private val budget: BudgetRepository,
) {

    suspend fun pendingCount(): Int = outbox.count()

    suspend fun drain(): DrainResult {
        val queued = outbox.pending()
        if (queued.isEmpty()) {
            return DrainResult(pushed = 0, failed = 0, stillPending = 0)
        }

        val idMap = mutableMapOf<String, String>()
        val done = mutableListOf<String>()
        var pushed = 0
        var failed = 0

        for (action in queued) {
            val result = replay(action, idMap)
            val error = result.exceptionOrNull()

            if (error != null && error.isOffline) {
                // Still no server. Everything from here stays queued, in order.
                break
            }

            done += action.id
            if (error == null) pushed++ else failed++
        }

        outbox.remove(done)

        // The cached rows still carry local ids and optimistic balances, so
        // they are dropped rather than reconciled: the next list() refills
        // them from the server, which is now the better source.
        if (pushed > 0) {
            cache.clear()
        }

        return DrainResult(pushed = pushed, failed = failed, stillPending = outbox.count())
    }

    /** The server id for a row created offline, or the id as it stands. */
    private fun Map<String, String>.resolve(id: String): String = this[id] ?: id

    private suspend fun replay(
        action: PendingAction,
        idMap: MutableMap<String, String>,
    ): Result<Unit> = when (action) {
        is PendingAction.CreateNote ->
            notes.create(action.title, action.body).record(action.subjectId, idMap) { it.id }

        is PendingAction.UpdateNote ->
            notes.update(idMap.resolve(action.subjectId), action.title, action.body).unit()

        is PendingAction.StarNote ->
            notes.setStarred(idMap.resolve(action.subjectId), action.isStarred).unit()

        is PendingAction.DeleteNote ->
            notes.delete(idMap.resolve(action.subjectId))

        is PendingAction.CreatePreset ->
            pomodoro.create(action.name, action.focusMinutes, action.breakMinutes)
                .record(action.subjectId, idMap) { it.id }

        is PendingAction.DeletePreset ->
            pomodoro.delete(idMap.resolve(action.subjectId))

        is PendingAction.CreateWorkout ->
            workout.create(action.activity, action.notes, action.loggedAt)
                .record(action.subjectId, idMap) { it.id }

        is PendingAction.DeleteWorkout ->
            workout.delete(idMap.resolve(action.subjectId))

        is PendingAction.CreateWatchList ->
            watchList.createList(action.name).record(action.subjectId, idMap) { it.id }

        is PendingAction.DeleteWatchList ->
            watchList.deleteList(idMap.resolve(action.subjectId))

        is PendingAction.CreateWatchListItem ->
            watchList.addItem(
                idMap.resolve(action.watchListId),
                action.title,
                action.note,
            ).record(action.subjectId, idMap) { it.id }

        is PendingAction.UpdateWatchListItem ->
            watchList.updateItem(idMap.resolve(action.subjectId), action.done).unit()

        is PendingAction.DeleteWatchListItem ->
            watchList.deleteItem(idMap.resolve(action.subjectId))

        is PendingAction.CreateAccount ->
            budget.createAccount(action.name).record(action.subjectId, idMap) { it.id }

        is PendingAction.DeleteAccount ->
            budget.deleteAccount(idMap.resolve(action.subjectId))

        is PendingAction.PostTransaction ->
            budget.post(
                idMap.resolve(action.accountId),
                action.type,
                action.amount,
                action.description,
            ).record(action.subjectId, idMap) { it.id }

        is PendingAction.DeleteTransaction ->
            budget.deleteTransaction(idMap.resolve(action.subjectId))

        is PendingAction.Transfer ->
            budget.transfer(
                idMap.resolve(action.fromAccountId),
                idMap.resolve(action.toAccountId),
                action.amount,
                action.description,
            )
    }

    /** Notes the real id this create was given, then discards the payload. */
    private fun <T> Result<T>.record(
        localId: String,
        idMap: MutableMap<String, String>,
        serverId: (T) -> String,
    ): Result<Unit> {
        getOrNull()?.let { created -> idMap[localId] = serverId(created) }

        return unit()
    }

    private fun <T> Result<T>.unit(): Result<Unit> = map { }
}
