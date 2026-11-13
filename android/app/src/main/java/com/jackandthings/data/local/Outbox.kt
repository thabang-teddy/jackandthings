package com.jackandthings.data.local

import com.jackandthings.model.PomodoroPresetDraft
import java.io.File
import java.util.UUID
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * One write the app made while signed in but unable to reach the server.
 *
 * Every variant records the call as the repository received it, not as HTTP,
 * so replaying it is just calling the same repository method again.
 *
 * Rows created offline are given a local UUID so the screen has something to
 * key on. A later edit or delete of such a row therefore refers to an id the
 * server has never seen, which is why [OutboxDrainer] carries a local -> server
 * id map while it replays.
 */
@Serializable
sealed interface PendingAction {

    /** This action's own id, so a drained one can be dropped by identity. */
    val id: String

    /** The row this action creates or touches, for the id map and the cache. */
    val subjectId: String

    @Serializable
    @SerialName("note.create")
    data class CreateNote(
        override val id: String = newId(),
        override val subjectId: String,
        val title: String,
        val body: String?,
    ) : PendingAction

    @Serializable
    @SerialName("note.update")
    data class UpdateNote(
        override val id: String = newId(),
        override val subjectId: String,
        val title: String,
        val body: String?,
    ) : PendingAction

    @Serializable
    @SerialName("note.star")
    data class StarNote(
        override val id: String = newId(),
        override val subjectId: String,
        val isStarred: Boolean,
    ) : PendingAction

    @Serializable
    @SerialName("note.delete")
    data class DeleteNote(
        override val id: String = newId(),
        override val subjectId: String,
    ) : PendingAction

    /**
     * The whole draft rather than a field per column: a preset carries
     * fourteen since issue #3, and a queued one has to replay as exactly what
     * was asked for, down to the sounds and the blocklist.
     */
    @Serializable
    @SerialName("preset.create")
    data class CreatePreset(
        override val id: String = newId(),
        override val subjectId: String,
        val draft: PomodoroPresetDraft,
    ) : PendingAction

    @Serializable
    @SerialName("preset.update")
    data class UpdatePreset(
        override val id: String = newId(),
        override val subjectId: String,
        val draft: PomodoroPresetDraft,
    ) : PendingAction

    @Serializable
    @SerialName("preset.delete")
    data class DeletePreset(
        override val id: String = newId(),
        override val subjectId: String,
    ) : PendingAction

    @Serializable
    @SerialName("workout.create")
    data class CreateWorkout(
        override val id: String = newId(),
        override val subjectId: String,
        val activity: String,
        val notes: String?,
        /** When it happened, not when the queue drained. */
        val loggedAt: String? = null,
    ) : PendingAction

    @Serializable
    @SerialName("workout.delete")
    data class DeleteWorkout(
        override val id: String = newId(),
        override val subjectId: String,
    ) : PendingAction

    @Serializable
    @SerialName("watchlist.create")
    data class CreateWatchList(
        override val id: String = newId(),
        override val subjectId: String,
        val name: String,
    ) : PendingAction

    @Serializable
    @SerialName("watchlist.delete")
    data class DeleteWatchList(
        override val id: String = newId(),
        override val subjectId: String,
    ) : PendingAction

    @Serializable
    @SerialName("watchlist.item.create")
    data class CreateWatchListItem(
        override val id: String = newId(),
        override val subjectId: String,
        val watchListId: String,
        val title: String,
        val note: String?,
    ) : PendingAction

    @Serializable
    @SerialName("watchlist.item.update")
    data class UpdateWatchListItem(
        override val id: String = newId(),
        override val subjectId: String,
        val done: Boolean,
    ) : PendingAction

    @Serializable
    @SerialName("watchlist.item.delete")
    data class DeleteWatchListItem(
        override val id: String = newId(),
        override val subjectId: String,
    ) : PendingAction

    @Serializable
    @SerialName("budget.account.create")
    data class CreateAccount(
        override val id: String = newId(),
        override val subjectId: String,
        val name: String,
    ) : PendingAction

    @Serializable
    @SerialName("budget.account.delete")
    data class DeleteAccount(
        override val id: String = newId(),
        override val subjectId: String,
    ) : PendingAction

    @Serializable
    @SerialName("budget.transaction.create")
    data class PostTransaction(
        override val id: String = newId(),
        override val subjectId: String,
        val accountId: String,
        /**
         * Renamed on the wire: kotlinx.serialization tells the variants of a
         * sealed hierarchy apart with a `type` discriminator, so a property
         * of that name makes encoding throw. OutboxTest round-trips every
         * variant, which is what catches this.
         */
        @SerialName("transaction_type") val type: String,
        val amount: String,
        val description: String?,
    ) : PendingAction

    @Serializable
    @SerialName("budget.transaction.delete")
    data class DeleteTransaction(
        override val id: String = newId(),
        override val subjectId: String,
    ) : PendingAction

    @Serializable
    @SerialName("budget.transfer")
    data class Transfer(
        override val id: String = newId(),
        override val subjectId: String,
        val fromAccountId: String,
        val toAccountId: String,
        val amount: String,
        val description: String?,
    ) : PendingAction

    companion object {
        fun newId(): String = UUID.randomUUID().toString()
    }
}

/**
 * The queue of writes waiting for the server, in the order they were made.
 *
 * Order is the whole point: "create a list, add an item to it, tick the item"
 * only replays correctly in sequence, so this is a queue and never a set.
 */
class Outbox(file: File) {

    private val store = JsonFileStore(file, PendingAction.serializer())
    private val mutex = Mutex()

    suspend fun pending(): List<PendingAction> = store.read()

    suspend fun count(): Int = store.read().size

    suspend fun add(action: PendingAction) = mutex.withLock {
        store.write(store.read() + action)
    }

    /** Drops the drained actions, keeping any added while the drain ran. */
    suspend fun remove(drained: Collection<String>) = mutex.withLock {
        store.write(store.read().filterNot { it.id in drained })
    }

    suspend fun clear() = mutex.withLock { store.write(emptyList()) }
}
