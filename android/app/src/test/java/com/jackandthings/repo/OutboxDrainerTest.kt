package com.jackandthings.repo

import com.jackandthings.data.local.OfflineCache
import com.jackandthings.data.local.Outbox
import com.jackandthings.data.local.PendingAction
import com.jackandthings.data.remote.ApiException
import com.jackandthings.model.Note
import com.jackandthings.model.PomodoroPresetDraft
import com.jackandthings.testing.FakeBudgetRepository
import com.jackandthings.testing.FakeNotesRepository
import com.jackandthings.testing.FakePomodoroRepository
import com.jackandthings.testing.FakeWatchListRepository
import com.jackandthings.testing.FakeWorkoutRepository
import java.io.File
import java.io.IOException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * Replaying the writes made while the server was unreachable.
 *
 * Three rules carry the weight, and each has a test below: replays happen in
 * order, a row created offline is referred to afterwards by the id the
 * server gave it, and a drain that runs into a dead connection again stops
 * where it is rather than pushing later actions past earlier ones.
 */
class OutboxDrainerTest {

    @get:Rule
    val folder = TemporaryFolder()

    private lateinit var cache: OfflineCache
    private lateinit var outbox: Outbox
    private lateinit var notes: FakeNotesRepository
    private lateinit var pomodoro: FakePomodoroRepository
    private lateinit var workout: FakeWorkoutRepository
    private lateinit var watchList: FakeWatchListRepository
    private lateinit var budget: FakeBudgetRepository
    private lateinit var drainer: OutboxDrainer

    private val offline = IOException("no route to host")

    @Before
    fun setUp() {
        cache = OfflineCache(folder.root)
        outbox = Outbox(File(folder.root, "outbox.json"))
        notes = FakeNotesRepository()
        pomodoro = FakePomodoroRepository()
        workout = FakeWorkoutRepository()
        watchList = FakeWatchListRepository()
        budget = FakeBudgetRepository()
        drainer = OutboxDrainer(outbox, cache, notes, pomodoro, workout, watchList, budget)
    }

    @Test
    fun `an empty queue does nothing`() = runTest {
        val result = drainer.drain()

        assertEquals(0, result.pushed)
        assertEquals(0, result.failed)
        assertEquals(0, result.stillPending)
        assertFalse(result.didWork)
    }

    @Test
    fun `queued writes are sent and the queue is emptied`() = runTest {
        outbox.add(PendingAction.CreateNote(subjectId = "local-1", title = "One", body = null))
        outbox.add(PendingAction.CreateNote(subjectId = "local-2", title = "Two", body = null))

        val result = drainer.drain()

        assertEquals(2, result.pushed)
        assertEquals(0, result.stillPending)
        assertEquals(listOf("One" to null, "Two" to null), notes.created)
    }

    @Test
    fun `writes replay in the order they were made`() = runTest {
        outbox.add(PendingAction.CreateWatchList(subjectId = "local-list", name = "Films"))
        outbox.add(
            PendingAction.CreateWatchListItem(
                subjectId = "local-item",
                watchListId = "local-list",
                title = "Arrival",
                note = null,
            ),
        )

        drainer.drain()

        // The list was created before the item that points at it, and the
        // item travelled under the id the server handed back.
        assertEquals(listOf("Films"), watchList.createdLists)
        val serverListId = watchList.lists.single().id
        assertEquals(listOf(Triple(serverListId, "Arrival", null)), watchList.addedItems)
    }

    @Test
    fun `a row created offline is referred to afterwards by its real id`() = runTest {
        outbox.add(PendingAction.CreateNote(subjectId = "local-1", title = "Draft", body = null))
        outbox.add(PendingAction.StarNote(subjectId = "local-1", isStarred = true))
        outbox.add(PendingAction.UpdateNote(subjectId = "local-1", title = "Final", body = "Body"))

        val result = drainer.drain()

        assertEquals(3, result.pushed)
        assertEquals(0, result.failed)

        // The fake names what it creates "note-1"; the local UUID must not
        // have reached the server on either of the follow-up calls.
        val serverId = notes.notes.single().id
        assertEquals(listOf(serverId to true), notes.starred)
        assertEquals(listOf(Triple(serverId, "Final", "Body")), notes.updated)
    }

    @Test
    fun `an item created offline joins the list created offline beside it`() = runTest {
        outbox.add(PendingAction.CreateWatchList(subjectId = "local-list", name = "Films"))
        outbox.add(
            PendingAction.CreateWatchListItem(
                subjectId = "local-item",
                watchListId = "local-list",
                title = "Arrival",
                note = null,
            ),
        )
        outbox.add(PendingAction.UpdateWatchListItem(subjectId = "local-item", done = true))

        drainer.drain()

        // Both follow-ups resolved their local ids: the item joined the real
        // list, and was then ticked by the id the server gave it.
        val serverItemId = "item-1"
        assertEquals(listOf(serverItemId to true), watchList.toggledIds)
    }

    @Test
    fun `a transaction posted offline lands on the account created offline`() = runTest {
        outbox.add(PendingAction.CreateAccount(subjectId = "local-account", name = "Everyday"))
        outbox.add(
            PendingAction.PostTransaction(
                subjectId = "local-txn",
                accountId = "local-account",
                type = "deposit",
                amount = "25.50",
                description = "Refund",
            ),
        )

        val result = drainer.drain()

        assertEquals(2, result.pushed)
        // The deposit must have gone to the id the server gave the account,
        // never the local one it was created under.
        val account = budget.accounts.single()
        assertEquals(listOf(account.id), budget.postedAccountIds)
    }

    @Test
    fun `a workout keeps the time it was logged, not the time it synced`() = runTest {
        val loggedAt = "2026-11-12T18:00:00Z"
        outbox.add(
            PendingAction.CreateWorkout(
                subjectId = "local-1",
                activity = "Push-ups",
                notes = null,
                loggedAt = loggedAt,
            ),
        )

        drainer.drain()

        assertEquals(loggedAt, workout.entries.single().loggedAt)
    }

    @Test
    fun `a drain stops at a server that is still away and keeps the rest`() = runTest {
        outbox.add(PendingAction.CreateNote(subjectId = "local-1", title = "One", body = null))
        outbox.add(
            PendingAction.CreatePreset(
                id = "p",
                subjectId = "local-2",
                draft = PomodoroPresetDraft(name = "Deep work", focusMinutes = 25, breakMinutes = 5),
            ),
        )
        outbox.add(PendingAction.CreateNote(subjectId = "local-3", title = "Three", body = null))
        pomodoro.failure = offline

        val result = drainer.drain()

        assertEquals(1, result.pushed)
        assertEquals(0, result.failed)
        // The preset and everything behind it stay queued, in order.
        assertEquals(2, result.stillPending)
        assertEquals(
            listOf("local-2", "local-3"),
            outbox.pending().map { it.subjectId },
        )
        // The third note must not have jumped the preset.
        assertEquals(listOf("One" to null), notes.created)
    }

    @Test
    fun `nothing is sent when the server is away from the start`() = runTest {
        outbox.add(PendingAction.CreateNote(subjectId = "local-1", title = "One", body = null))
        notes.failure = offline

        val result = drainer.drain()

        assertEquals(0, result.pushed)
        assertEquals(1, result.stillPending)
    }

    @Test
    fun `an action the server refuses is dropped rather than retried forever`() = runTest {
        outbox.add(PendingAction.CreateNote(subjectId = "local-1", title = "", body = null))
        notes.failure = ApiException(422, "The title field is required.")

        val result = drainer.drain()

        assertEquals(0, result.pushed)
        assertEquals(1, result.failed)
        assertEquals(0, result.stillPending)
        assertTrue(result.didWork)
    }

    @Test
    fun `a refused action does not block the ones behind it`() = runTest {
        outbox.add(
            PendingAction.CreatePreset(
                id = "p",
                subjectId = "local-1",
                draft = PomodoroPresetDraft(name = "", focusMinutes = 25, breakMinutes = 5),
            ),
        )
        outbox.add(PendingAction.CreateNote(subjectId = "local-2", title = "Two", body = null))
        pomodoro.failure = ApiException(422, "The name field is required.")

        val result = drainer.drain()

        assertEquals(1, result.pushed)
        assertEquals(1, result.failed)
        assertEquals(0, result.stillPending)
        assertEquals(listOf("Two" to null), notes.created)
    }

    @Test
    fun `cached rows are dropped once anything reaches the server`() = runTest {
        // Local ids and optimistic balances; the next read should come from
        // the server rather than be reconciled against these.
        cache.notes.write(listOf(Note(id = "local-1", title = "Draft")))
        outbox.add(PendingAction.CreateNote(subjectId = "local-1", title = "Draft", body = null))

        drainer.drain()

        assertEquals(emptyList<Note>(), cache.notes.read())
    }

    @Test
    fun `cached rows are kept when nothing could be sent`() = runTest {
        cache.notes.write(listOf(Note(id = "local-1", title = "Draft")))
        outbox.add(PendingAction.CreateNote(subjectId = "local-1", title = "Draft", body = null))
        notes.failure = offline

        drainer.drain()

        assertEquals(1, cache.notes.read().size)
    }

    @Test
    fun `the pending count is what is waiting`() = runTest {
        assertEquals(0, drainer.pendingCount())

        outbox.add(PendingAction.DeleteNote(subjectId = "local-1"))
        outbox.add(PendingAction.DeleteNote(subjectId = "local-2"))

        assertEquals(2, drainer.pendingCount())
    }
}
