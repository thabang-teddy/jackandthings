package com.jackandthings.data.local

import com.jackandthings.model.PomodoroPresetDraft
import java.io.File
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * The queue of writes waiting for the server.
 *
 * Order and the JSON round trip are the two things worth pinning down: the
 * drainer depends on replaying in sequence, and this is the only place in
 * the app that serialises a sealed hierarchy, so a missing `@SerialName`
 * would only show up as a queue that silently fails to load.
 */
class OutboxTest {

    @get:Rule
    val folder = TemporaryFolder()

    private lateinit var file: File
    private lateinit var outbox: Outbox

    @Before
    fun setUp() {
        file = File(folder.root, "outbox.json")
        outbox = Outbox(file)
    }

    @Test
    fun `a new outbox is empty`() = runTest {
        assertEquals(0, outbox.count())
        assertEquals(emptyList<PendingAction>(), outbox.pending())
    }

    @Test
    fun `actions come back in the order they were added`() = runTest {
        outbox.add(PendingAction.CreateWatchList(subjectId = "list-1", name = "Films"))
        outbox.add(
            PendingAction.CreateWatchListItem(
                subjectId = "item-1",
                watchListId = "list-1",
                title = "Arrival",
                note = null,
            ),
        )
        outbox.add(PendingAction.UpdateWatchListItem(subjectId = "item-1", done = true))

        val queued = outbox.pending()

        assertEquals(3, queued.size)
        assertTrue(queued[0] is PendingAction.CreateWatchList)
        assertTrue(queued[1] is PendingAction.CreateWatchListItem)
        assertTrue(queued[2] is PendingAction.UpdateWatchListItem)
    }

    @Test
    fun `every variant survives the trip through JSON`() = runTest {
        val actions = listOf(
            PendingAction.CreateNote(subjectId = "n1", title = "Note", body = "Body"),
            PendingAction.UpdateNote(subjectId = "n1", title = "Edited", body = null),
            PendingAction.StarNote(subjectId = "n1", isStarred = true),
            PendingAction.DeleteNote(subjectId = "n1"),
            PendingAction.CreatePreset(
                subjectId = "p1",
                // Everything a preset carries, not just the minutes: this
                // test exists to prove a queued action replays as exactly
                // what was asked for.
                draft = PomodoroPresetDraft(
                    name = "Deep work",
                    focusMinutes = 25,
                    breakMinutes = 5,
                    longBreakMinutes = 20,
                    cyclesBeforeLongBreak = 3,
                    autoStartBreaks = false,
                    autoStartFocus = true,
                    tag = "Coding",
                    alarmSound = "bell",
                    tickingSound = "soft",
                    ambience = "rain",
                    strictMode = true,
                    blockedSites = listOf("news.ycombinator.com"),
                ),
            ),
            PendingAction.UpdatePreset(
                subjectId = "p1",
                draft = PomodoroPresetDraft(name = "Deeper", focusMinutes = 50, breakMinutes = 10),
            ),
            PendingAction.DeletePreset(subjectId = "p1"),
            PendingAction.CreateWorkout(
                subjectId = "w1",
                activity = "Push-ups",
                notes = "3 x 20",
                loggedAt = "2026-11-12T18:00:00Z",
            ),
            PendingAction.DeleteWorkout(subjectId = "w1"),
            PendingAction.CreateWatchList(subjectId = "l1", name = "Films"),
            PendingAction.DeleteWatchList(subjectId = "l1"),
            PendingAction.CreateWatchListItem(
                subjectId = "i1",
                watchListId = "l1",
                title = "Arrival",
                note = "rewatch",
            ),
            PendingAction.UpdateWatchListItem(subjectId = "i1", done = true),
            PendingAction.DeleteWatchListItem(subjectId = "i1"),
            PendingAction.CreateAccount(subjectId = "a1", name = "Everyday"),
            PendingAction.DeleteAccount(subjectId = "a1"),
            PendingAction.PostTransaction(
                subjectId = "t1",
                accountId = "a1",
                type = "deposit",
                amount = "125.50",
                description = "Salary",
            ),
            PendingAction.DeleteTransaction(subjectId = "t1"),
            PendingAction.Transfer(
                subjectId = "x1",
                fromAccountId = "a1",
                toAccountId = "a2",
                amount = "40.00",
                description = null,
            ),
        )

        actions.forEach { outbox.add(it) }

        // A second instance over the same file, so nothing is served from
        // memory: this is the queue as a later process would find it.
        assertEquals(actions, Outbox(file).pending())
    }

    @Test
    fun `draining some leaves the rest alone`() = runTest {
        val first = PendingAction.CreateNote(subjectId = "n1", title = "One", body = null)
        val second = PendingAction.CreateNote(subjectId = "n2", title = "Two", body = null)
        val third = PendingAction.CreateNote(subjectId = "n3", title = "Three", body = null)
        listOf(first, second, third).forEach { outbox.add(it) }

        outbox.remove(listOf(first.id, second.id))

        assertEquals(listOf(third), outbox.pending())
        assertEquals(1, outbox.count())
    }

    @Test
    fun `clearing empties the queue`() = runTest {
        outbox.add(PendingAction.DeleteNote(subjectId = "n1"))

        outbox.clear()

        assertEquals(0, outbox.count())
    }

    @Test
    fun `each action gets its own id`() {
        val one = PendingAction.DeleteNote(subjectId = "same")
        val two = PendingAction.DeleteNote(subjectId = "same")

        assertTrue(one.id != two.id)
    }
}
