package com.jackandthings.repo

import com.jackandthings.data.local.OfflineCache
import com.jackandthings.data.local.Outbox
import com.jackandthings.data.local.PendingAction
import com.jackandthings.data.remote.ApiException
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.Note
import com.jackandthings.model.WatchList
import com.jackandthings.model.WorkoutEntry
import com.jackandthings.testing.FakeBudgetRepository
import com.jackandthings.testing.FakeNotesRepository
import com.jackandthings.testing.FakeWatchListRepository
import com.jackandthings.testing.FakeWorkoutRepository
import java.io.File
import java.io.IOException
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * What a signed-in session does when the server cannot be reached.
 *
 * The shape being checked throughout: a write that cannot be sent is
 * reported as saved, lands in the outbox, and shows up in the cached list
 * straight away - while a write the server actively refused does none of
 * those things and comes back as the error it was.
 */
class OfflineRepositoriesTest {

    @get:Rule
    val folder = TemporaryFolder()

    private lateinit var cache: OfflineCache
    private lateinit var outbox: Outbox

    private val offline = IOException("no route to host")
    private val refused = ApiException(422, "The title field is required.")

    @Before
    fun setUp() {
        cache = OfflineCache(folder.root)
        outbox = Outbox(File(folder.root, "outbox.json"))
    }

    // ── Notes ──────────────────────────────────────────────────────────────

    @Test
    fun `a note created offline is reported saved and queued`() = runTest {
        val remote = FakeNotesRepository().apply { failure = offline }
        val repo = OfflineNotesRepository(remote, cache, outbox)

        val note = repo.create("Shopping list", "Milk").getOrThrow()

        assertEquals("Shopping list", note.title)
        assertEquals(listOf(note), cache.notes.read())

        val queued = outbox.pending().single() as PendingAction.CreateNote
        assertEquals("Shopping list", queued.title)
        assertEquals(note.id, queued.subjectId)
    }

    @Test
    fun `a note the server refuses is not queued`() = runTest {
        val remote = FakeNotesRepository().apply { failure = refused }
        val repo = OfflineNotesRepository(remote, cache, outbox)

        val result = repo.create("", null)

        assertTrue(result.isFailure)
        assertEquals(refused, result.exceptionOrNull())
        assertEquals(0, outbox.count())
        assertEquals(emptyList<Note>(), cache.notes.read())
    }

    @Test
    fun `a note that reaches the server is not queued`() = runTest {
        val repo = OfflineNotesRepository(FakeNotesRepository(), cache, outbox)

        repo.create("Shopping list", "Milk").getOrThrow()

        assertEquals(0, outbox.count())
    }

    @Test
    fun `starring offline updates the cached note`() = runTest {
        val remote = FakeNotesRepository(mutableListOf(Note(id = "n1", title = "Project idea")))
        val repo = OfflineNotesRepository(remote, cache, outbox)
        repo.list().getOrThrow()

        remote.failure = offline
        val starred = repo.setStarred("n1", true).getOrThrow()

        assertTrue(starred.isStarred)
        assertTrue(cache.notes.read().single().isStarred)

        val queued = outbox.pending().single() as PendingAction.StarNote
        assertEquals("n1", queued.subjectId)
        assertTrue(queued.isStarred)
    }

    @Test
    fun `deleting offline takes the note out of the cached list`() = runTest {
        val remote = FakeNotesRepository(mutableListOf(Note(id = "n1", title = "Draft")))
        val repo = OfflineNotesRepository(remote, cache, outbox)
        repo.list().getOrThrow()

        remote.failure = offline
        repo.delete("n1").getOrThrow()

        assertEquals(emptyList<Note>(), cache.notes.read())
        assertTrue(outbox.pending().single() is PendingAction.DeleteNote)
    }

    @Test
    fun `the notes list falls back to what was last seen`() = runTest {
        val remote = FakeNotesRepository(mutableListOf(Note(id = "n1", title = "Project idea")))
        val repo = OfflineNotesRepository(remote, cache, outbox)
        repo.list().getOrThrow()

        remote.failure = offline

        assertEquals("Project idea", repo.list().getOrThrow().single().title)
    }

    // ── Workout ────────────────────────────────────────────────────────────

    @Test
    fun `a workout logged offline keeps the time it happened`() = runTest {
        val remote = FakeWorkoutRepository().apply { failure = offline }
        val repo = OfflineWorkoutRepository(remote, cache, outbox)

        val before = Instant.now().minusSeconds(1)
        val entry = repo.create("Push-ups", "3 x 20").getOrThrow()

        val queued = outbox.pending().single() as PendingAction.CreateWorkout
        assertEquals(entry.loggedAt, queued.loggedAt)

        val loggedAt = Instant.parse(queued.loggedAt)
        assertTrue(loggedAt.isAfter(before))
        assertTrue(loggedAt.isBefore(Instant.now().plusSeconds(1)))
    }

    @Test
    fun `the nudge is answered from cached entries when the server is away`() = runTest {
        val thisHour = Instant.now().truncatedTo(ChronoUnit.HOURS).plusSeconds(60)
        val remote = FakeWorkoutRepository(
            mutableListOf(
                WorkoutEntry(id = "w1", activity = "Run", loggedAt = thisHour.toString()),
            ),
        )
        val repo = OfflineWorkoutRepository(remote, cache, outbox)
        repo.list().getOrThrow()

        remote.reminderFailure = offline
        val state = repo.reminderState().getOrThrow()

        assertFalse(state.due)
        assertEquals(thisHour.toString(), state.lastLoggedAt)
    }

    @Test
    fun `the nudge is due offline when nothing was logged this hour`() = runTest {
        val lastHour = Instant.now().truncatedTo(ChronoUnit.HOURS).minusSeconds(120)
        val remote = FakeWorkoutRepository(
            mutableListOf(
                WorkoutEntry(id = "w1", activity = "Run", loggedAt = lastHour.toString()),
            ),
        )
        val repo = OfflineWorkoutRepository(remote, cache, outbox)
        repo.list().getOrThrow()

        remote.reminderFailure = offline

        assertTrue(repo.reminderState().getOrThrow().due)
    }

    // ── Watch list ─────────────────────────────────────────────────────────

    @Test
    fun `an item added offline joins its list in the cache`() = runTest {
        val remote = FakeWatchListRepository(
            mutableListOf(WatchList(id = "l1", name = "Films")),
        )
        val repo = OfflineWatchListRepository(remote, cache, outbox)
        repo.lists().getOrThrow()

        remote.failure = offline
        val item = repo.addItem("l1", "Arrival", null).getOrThrow()

        assertEquals(listOf(item), cache.watchLists.read().single().items)

        val queued = outbox.pending().single() as PendingAction.CreateWatchListItem
        assertEquals("l1", queued.watchListId)
    }

    @Test
    fun `ticking an item offline shows it done`() = runTest {
        val remote = FakeWatchListRepository(mutableListOf(WatchList(id = "l1", name = "Films")))
        val repo = OfflineWatchListRepository(remote, cache, outbox)
        repo.lists().getOrThrow()
        remote.failure = offline
        val item = repo.addItem("l1", "Arrival", null).getOrThrow()

        repo.updateItem(item.id, done = true).getOrThrow()

        assertTrue(cache.watchLists.read().single().items.single().done)
    }

    // ── Budget ─────────────────────────────────────────────────────────────

    @Test
    fun `a deposit made offline moves the cached balance`() = runTest {
        val remote = FakeBudgetRepository(
            mutableListOf(BudgetAccount(id = "a1", name = "Everyday", balanceCents = 10_000)),
        )
        val repo = OfflineBudgetRepository(remote, cache, outbox)
        repo.accounts().getOrThrow()

        remote.writeFailure = offline
        repo.post("a1", "deposit", "25.50", "Refund").getOrThrow()

        assertEquals(12_550L, cache.budgetAccounts.read().single().balanceCents)
        assertEquals("Everyday", cache.budgetTransactions.read().single().account)
    }

    @Test
    fun `a withdrawal made offline takes the cached balance down`() = runTest {
        val remote = FakeBudgetRepository(
            mutableListOf(BudgetAccount(id = "a1", name = "Everyday", balanceCents = 10_000)),
        )
        val repo = OfflineBudgetRepository(remote, cache, outbox)
        repo.accounts().getOrThrow()

        remote.writeFailure = offline
        repo.post("a1", "withdrawal", "25.50", null).getOrThrow()

        assertEquals(7_450L, cache.budgetAccounts.read().single().balanceCents)
    }

    @Test
    fun `a transfer made offline writes both legs and moves both balances`() = runTest {
        val remote = FakeBudgetRepository(
            mutableListOf(
                BudgetAccount(id = "a1", name = "Everyday", balanceCents = 10_000),
                BudgetAccount(id = "a2", name = "Savings", balanceCents = 0),
            ),
        )
        val repo = OfflineBudgetRepository(remote, cache, outbox)
        repo.accounts().getOrThrow()

        remote.writeFailure = offline
        repo.transfer("a1", "a2", "40.00", "Monthly").getOrThrow()

        val balances = cache.budgetAccounts.read().associate { it.name to it.balanceCents }
        assertEquals(6_000L, balances["Everyday"])
        assertEquals(4_000L, balances["Savings"])

        val legs = cache.budgetTransactions.read().map { it.type }.toSet()
        assertEquals(setOf("transfer_in", "transfer_out"), legs)
        assertTrue(outbox.pending().single() is PendingAction.Transfer)
    }

    @Test
    fun `an amount that is not a number is refused rather than queued`() = runTest {
        val remote = FakeBudgetRepository(
            mutableListOf(BudgetAccount(id = "a1", name = "Everyday")),
        ).apply { writeFailure = offline }
        val repo = OfflineBudgetRepository(remote, cache, outbox)

        val result = repo.post("a1", "deposit", "not money", null)

        assertTrue(result.isFailure)
        assertEquals(0, outbox.count())
    }
}
