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
import com.jackandthings.testing.FakeBudgetRepository
import com.jackandthings.testing.FakeNotesRepository
import com.jackandthings.testing.FakePomodoroRepository
import com.jackandthings.testing.FakeWatchListRepository
import com.jackandthings.testing.FakeWorkoutRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * Pushing the signed-out backlog up to an account.
 *
 * The ordering rules are what matter here: accounts and lists have to exist
 * remotely before the rows that point at them, and anything that fails has
 * to stay behind in a state the next attempt can still make sense of.
 */
class SyncManagerTest {

    @get:Rule
    val folder = TemporaryFolder()

    private lateinit var stores: LocalStores
    private lateinit var notes: FakeNotesRepository
    private lateinit var pomodoro: FakePomodoroRepository
    private lateinit var workout: FakeWorkoutRepository
    private lateinit var budget: FakeBudgetRepository
    private lateinit var watchList: FakeWatchListRepository
    private lateinit var sync: SyncManager

    @Before
    fun setUp() {
        stores = LocalStores(folder.root)
        notes = FakeNotesRepository()
        pomodoro = FakePomodoroRepository()
        workout = FakeWorkoutRepository()
        budget = FakeBudgetRepository()
        watchList = FakeWatchListRepository()
        sync = SyncManager(stores, notes, pomodoro, workout, budget, watchList)
    }

    @Test
    fun `an empty device has nothing to offer`() = runTest {
        assertFalse(sync.hasPendingData())

        val result = sync.sync()

        assertEquals(0, result.pushed)
        assertTrue(result.success)
    }

    @Test
    fun `anything waiting locally counts as pending`() = runTest {
        stores.notes.write(listOf(Note("local-1", "Shopping list", null)))

        assertTrue(sync.hasPendingData())
    }

    @Test
    fun `notes presets and workouts go up and are cleared`() = runTest {
        stores.notes.write(listOf(Note("local-1", "Shopping list", "Milk")))
        stores.presets.write(listOf(PomodoroPreset("local-2", "Deep work", 25, 5)))
        stores.workoutEntries.write(listOf(WorkoutEntry("local-3", "Push-ups", "3 x 20")))

        val result = sync.sync()

        assertTrue(result.errors.toString(), result.success)
        assertEquals(3, result.pushed)
        assertEquals(listOf("Shopping list" to "Milk"), notes.created)
        assertEquals(listOf("Deep work"), pomodoro.presets.map { it.name })
        assertEquals(listOf("Push-ups" to "3 x 20"), workout.created)

        // Nothing is left to offer a second time.
        assertFalse(sync.hasPendingData())
    }

    @Test
    fun `a note that fails to go up stays for the next attempt`() = runTest {
        stores.notes.write(listOf(Note("local-1", "Shopping list", null)))
        notes.failure = RuntimeException("offline")

        val result = sync.sync()

        assertFalse(result.success)
        assertEquals(0, result.pushed)
        assertEquals(listOf("Shopping list"), stores.notes.read().map { it.title })
    }

    @Test
    fun `a watch list goes up with its items`() = runTest {
        stores.watchLists.write(
            listOf(
                WatchList(
                    id = "local-list",
                    name = "Films",
                    items = listOf(
                        WatchListItem("local-a", "local-list", "Dune", null, done = false),
                        WatchListItem("local-b", "local-list", "Arrival", null, done = true),
                    ),
                ),
            ),
        )

        val result = sync.sync()

        assertTrue(result.errors.toString(), result.success)
        assertEquals(listOf("Films"), watchList.createdLists)
        assertEquals(listOf("Dune", "Arrival"), watchList.addedItems.map { it.second })
        // The one already ticked off is marked done after it is created.
        assertEquals(1, watchList.toggledIds.count { it.second })
        assertTrue(stores.watchLists.read().isEmpty())
    }

    @Test
    fun `accounts go up before the transactions that point at them`() = runTest {
        stores.budgetAccounts.write(listOf(BudgetAccount("local-acc", "Everyday", 0)))
        stores.budgetTransactions.write(
            listOf(
                BudgetTransaction(
                    id = "local-tx",
                    type = "deposit",
                    amountCents = 12550,
                    description = "Pay",
                    account = AccountRef("local-acc", "Everyday"),
                ),
            ),
        )

        val result = sync.sync()

        assertTrue(result.errors.toString(), result.success)
        // The amount travels as the decimal string the API expects.
        assertEquals(listOf("125.50"), budget.postedAmounts)
        // And against the id the server gave back, not the local one.
        assertEquals(listOf("acc-1"), budget.accounts.map { it.id })
        assertTrue(stores.budgetAccounts.read().isEmpty())
        assertTrue(stores.budgetTransactions.read().isEmpty())
    }

    @Test
    fun `a transfer is replayed as one call, not as its two display rows`() = runTest {
        stores.budgetAccounts.write(
            listOf(
                BudgetAccount("local-from", "Everyday", 0),
                BudgetAccount("local-to", "Savings", 0),
            ),
        )
        stores.budgetTransactions.write(
            listOf(
                BudgetTransaction(
                    "local-out", "transfer_out", 4000, null,
                    AccountRef("local-from", "Everyday"), AccountRef("local-to", "Savings"),
                ),
                BudgetTransaction(
                    "local-in", "transfer_in", 4000, null,
                    AccountRef("local-to", "Savings"), AccountRef("local-from", "Everyday"),
                ),
            ),
        )
        stores.pendingTransfers.write(
            listOf(PendingTransfer("local-t", "local-from", "local-to", 4000, "Rainy day")),
        )

        val result = sync.sync()

        assertTrue(result.errors.toString(), result.success)
        // One transfer, no stray deposits or withdrawals from the legs.
        assertEquals(1, budget.transfers.size)
        assertTrue(budget.postedAmounts.isEmpty())

        val (from, to, amount) = budget.transfers.single()
        assertEquals("acc-1", from)
        assertEquals("acc-2", to)
        assertEquals("40.00", amount)
        assertTrue(stores.budgetTransactions.read().isEmpty())
        assertTrue(stores.pendingTransfers.read().isEmpty())
    }

    @Test
    fun `a transaction left behind keeps the server id of its synced account`() = runTest {
        stores.budgetAccounts.write(listOf(BudgetAccount("local-acc", "Everyday", 0)))
        stores.budgetTransactions.write(
            listOf(
                BudgetTransaction(
                    id = "local-tx",
                    type = "deposit",
                    amountCents = 1000,
                    description = "Pay",
                    account = AccountRef("local-acc", "Everyday"),
                ),
            ),
        )
        // The account goes up; the transaction behind it does not.
        budget.failAfterAccounts = true

        val result = sync.sync()

        assertFalse(result.success)
        // The account is not offered again, so it cannot be duplicated.
        assertTrue(stores.budgetAccounts.read().isEmpty())
        // And the stranded transaction now points at the real account, so a
        // later attempt still resolves without the local row to map from.
        assertEquals("acc-1", stores.budgetTransactions.read().single().account?.id)
    }
}
