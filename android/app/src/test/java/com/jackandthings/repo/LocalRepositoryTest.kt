package com.jackandthings.repo

import com.jackandthings.data.local.JsonFileStore
import com.jackandthings.data.local.PendingTransfer
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.Note
import com.jackandthings.model.WatchList
import com.jackandthings.model.WorkoutEntry
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * The file-backed repositories that stand in for the API while signed out.
 * Each gets a real store in a temp folder rather than a fake, since the
 * round trip through JSON is half of what is being checked.
 */
class LocalRepositoryTest {

    @get:Rule
    val folder = TemporaryFolder()

    private inline fun <reified T> store(
        name: String,
        serializer: kotlinx.serialization.KSerializer<T>,
    ) = JsonFileStore(folder.newFile(name), serializer)

    // ── Notes ──────────────────────────────────────────────────────────────

    @Test
    fun `a note survives being written and read back`() = runTest {
        val repo = LocalNotesRepository(store("notes.json", Note.serializer()))

        val created = repo.create("Shopping list", "Milk").getOrThrow()

        assertEquals(listOf(created), repo.list().getOrThrow())
        assertTrue(created.id.isNotBlank())
    }

    @Test
    fun `editing a note keeps its id`() = runTest {
        val repo = LocalNotesRepository(store("notes.json", Note.serializer()))
        val created = repo.create("Draft", null).getOrThrow()

        repo.update(created.id, "Final", "Body").getOrThrow()

        val stored = repo.list().getOrThrow().single()
        assertEquals(created.id, stored.id)
        assertEquals("Final", stored.title)
        assertEquals("Body", stored.body)
    }

    @Test
    fun `deleting a note removes only that one`() = runTest {
        val repo = LocalNotesRepository(store("notes.json", Note.serializer()))
        val keep = repo.create("Keep", null).getOrThrow()
        val drop = repo.create("Drop", null).getOrThrow()

        repo.delete(drop.id).getOrThrow()

        assertEquals(listOf(keep), repo.list().getOrThrow())
    }

    // ── Budget ─────────────────────────────────────────────────────────────

    private fun budgetRepo() = LocalBudgetRepository(
        accounts = store("accounts.json", BudgetAccount.serializer()),
        transactions = store("transactions.json", BudgetTransaction.serializer()),
        transfers = store("transfers.json", PendingTransfer.serializer()),
    )

    @Test
    fun `a balance is derived from the ledger, not stored`() = runTest {
        val repo = budgetRepo()
        val account = repo.createAccount("Everyday").getOrThrow()
        assertEquals(0L, repo.accounts().getOrThrow().single().balanceCents)

        repo.post(account.id, "deposit", "150.00", null).getOrThrow()
        repo.post(account.id, "withdrawal", "25.50", null).getOrThrow()

        assertEquals(12450L, repo.accounts().getOrThrow().single().balanceCents)
    }

    @Test
    fun `a transfer moves money both ways and records one pending replay`() = runTest {
        val transfers = store("transfers.json", PendingTransfer.serializer())
        val repo = LocalBudgetRepository(
            accounts = store("accounts.json", BudgetAccount.serializer()),
            transactions = store("transactions.json", BudgetTransaction.serializer()),
            transfers = transfers,
        )
        val from = repo.createAccount("Everyday").getOrThrow()
        val to = repo.createAccount("Savings").getOrThrow()
        repo.post(from.id, "deposit", "100.00", null).getOrThrow()

        repo.transfer(from.id, to.id, "40.00", "Rainy day").getOrThrow()

        val balances = repo.accounts().getOrThrow().associate { it.name to it.balanceCents }
        assertEquals(6000L, balances["Everyday"])
        assertEquals(4000L, balances["Savings"])

        // Two display rows, but only one call to replay when it syncs.
        assertEquals(2, repo.transactions().getOrThrow().count { it.type.startsWith("transfer") })
        assertEquals(1, transfers.read().size)
        assertEquals(4000L, transfers.read().single().amountCents)
    }

    @Test
    fun `posting against an unknown account fails rather than inventing one`() = runTest {
        val repo = budgetRepo()

        val result = repo.post("not-an-account", "deposit", "10.00", null)

        assertTrue(result.isFailure)
        assertTrue(repo.transactions().getOrThrow().isEmpty())
    }

    @Test
    fun `an unparseable amount is refused`() = runTest {
        val repo = budgetRepo()
        val account = repo.createAccount("Everyday").getOrThrow()

        val result = repo.post(account.id, "deposit", "lots", null)

        assertTrue(result.isFailure)
        assertTrue(repo.transactions().getOrThrow().isEmpty())
    }

    // ── Workout ────────────────────────────────────────────────────────────

    @Test
    fun `a fresh log counts as this hour, so nothing is due`() = runTest {
        val repo = LocalWorkoutRepository(store("workouts.json", WorkoutEntry.serializer()))

        repo.create("Push-ups", null).getOrThrow()

        val reminder = repo.reminderState().getOrThrow()
        assertFalse(reminder.due)
        assertNotNull(reminder.lastLoggedAt)
    }

    @Test
    fun `an entry from an earlier hour leaves the nudge due`() = runTest {
        val entries = store("workouts.json", WorkoutEntry.serializer())
        val twoHoursAgo = Instant.now().minus(2, ChronoUnit.HOURS).toString()
        entries.write(listOf(WorkoutEntry("w-1", "Run", null, loggedAt = twoHoursAgo)))
        val repo = LocalWorkoutRepository(entries)

        val reminder = repo.reminderState().getOrThrow()

        assertTrue(reminder.due)
        assertEquals(twoHoursAgo, reminder.lastLoggedAt)
    }

    @Test
    fun `with nothing logged at all the nudge is due and there is no last time`() = runTest {
        val repo = LocalWorkoutRepository(store("workouts.json", WorkoutEntry.serializer()))

        val reminder = repo.reminderState().getOrThrow()

        assertTrue(reminder.due)
        assertEquals(null, reminder.lastLoggedAt)
    }

    @Test
    fun `there are no presets to offer without an account`() = runTest {
        val repo = LocalWorkoutRepository(store("workouts.json", WorkoutEntry.serializer()))

        assertTrue(repo.presets().getOrThrow().isEmpty())
    }

    // ── Watch list ─────────────────────────────────────────────────────────

    @Test
    fun `items nest under the list they belong to`() = runTest {
        val repo = LocalWatchListRepository(store("lists.json", WatchList.serializer()))
        val list = repo.createList("Films").getOrThrow()

        val item = repo.addItem(list.id, "Dune", null).getOrThrow()

        val stored = repo.lists().getOrThrow().single()
        assertEquals(listOf(item), stored.items)
        assertEquals(list.id, item.watchListId)
    }

    @Test
    fun `ticking an item off is remembered`() = runTest {
        val repo = LocalWatchListRepository(store("lists.json", WatchList.serializer()))
        val list = repo.createList("Films").getOrThrow()
        val item = repo.addItem(list.id, "Dune", null).getOrThrow()

        repo.updateItem(item.id, done = true).getOrThrow()

        assertTrue(repo.lists().getOrThrow().single().items.single().done)
    }

    @Test
    fun `adding to a list that is not there fails`() = runTest {
        val repo = LocalWatchListRepository(store("lists.json", WatchList.serializer()))

        assertTrue(repo.addItem("nope", "Dune", null).isFailure)
    }

    @Test
    fun `deleting a list takes its items with it`() = runTest {
        val repo = LocalWatchListRepository(store("lists.json", WatchList.serializer()))
        val list = repo.createList("Films").getOrThrow()
        repo.addItem(list.id, "Dune", null).getOrThrow()

        repo.deleteList(list.id).getOrThrow()

        assertTrue(repo.lists().getOrThrow().isEmpty())
    }
}
