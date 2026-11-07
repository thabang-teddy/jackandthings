package com.jackandthings.ui.budget

import com.jackandthings.model.BudgetAccount
import com.jackandthings.testing.FakeBudgetRepository
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BudgetViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val cash = BudgetAccount("acc-1", "Cash", 367_450)
    private val savings = BudgetAccount("acc-2", "Savings", 100_000)

    @Test
    fun `accounts and transactions load together`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBudgetRepository(mutableListOf(cash, savings))
            val model = BudgetViewModel(repo)

            advanceUntilIdle()

            assertEquals(2, model.state.value.accounts.size)
            assertFalse(model.state.value.loading)
            assertNull(model.state.value.error)
        }

    @Test
    fun `the total is the sum of the account balances`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = BudgetViewModel(FakeBudgetRepository(mutableListOf(cash, savings)))

            advanceUntilIdle()

            assertEquals(467_450L, model.state.value.totalCents)
        }

    @Test
    fun `transferring needs two accounts`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val one = BudgetViewModel(FakeBudgetRepository(mutableListOf(cash)))
        advanceUntilIdle()
        assertFalse(one.state.value.canTransfer)

        val two = BudgetViewModel(FakeBudgetRepository(mutableListOf(cash, savings)))
        advanceUntilIdle()
        assertTrue(two.state.value.canTransfer)
    }

    @Test
    fun `a failed load reports the error rather than showing an empty budget`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBudgetRepository().apply {
                accountsFailure = RuntimeException("server down")
            }
            val model = BudgetViewModel(repo)

            advanceUntilIdle()

            assertEquals("server down", model.state.value.error)
            assertFalse(model.state.value.loading)
        }

    @Test
    fun `a partial failure keeps whatever already loaded`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBudgetRepository(mutableListOf(cash, savings))
            val model = BudgetViewModel(repo)
            advanceUntilIdle()

            // Transactions start failing; the balances already on screen
            // should not be wiped out by a later refresh.
            repo.transactionsFailure = RuntimeException("timed out")
            model.refresh()
            advanceUntilIdle()

            assertEquals(2, model.state.value.accounts.size)
            assertEquals("timed out", model.state.value.error)
        }

    @Test
    fun `posting a transaction closes the composer and reloads`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBudgetRepository(mutableListOf(cash))
            val model = BudgetViewModel(repo)
            advanceUntilIdle()
            model.openSheet(BudgetSheet.Transaction)

            model.post(cash.id, "deposit", "125.50", "Payday")
            advanceUntilIdle()

            assertEquals(BudgetSheet.None, model.state.value.sheet)
            assertFalse(model.state.value.saving)
            // The typed text reaches the repository untouched; the server
            // converts it, so no float ever handles the amount.
            assertEquals(listOf("125.50"), repo.postedAmounts)
        }

    @Test
    fun `a rejected transaction keeps the composer open with the reason`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBudgetRepository(mutableListOf(cash))
            val model = BudgetViewModel(repo)
            advanceUntilIdle()
            model.openSheet(BudgetSheet.Transaction)
            repo.writeFailure = RuntimeException("That is more than the account holds.")

            model.post(cash.id, "withdrawal", "9999.00", "")
            advanceUntilIdle()

            assertEquals(BudgetSheet.Transaction, model.state.value.sheet)
            assertEquals("That is more than the account holds.", model.state.value.error)
            assertFalse(model.state.value.saving)
        }

    @Test
    fun `a transfer passes both accounts through`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBudgetRepository(mutableListOf(cash, savings))
            val model = BudgetViewModel(repo)
            advanceUntilIdle()

            model.transfer(cash.id, savings.id, "100.00", "")
            advanceUntilIdle()

            assertEquals(listOf(Triple(cash.id, savings.id, "100.00")), repo.transfers)
            assertEquals(BudgetSheet.None, model.state.value.sheet)
        }

    @Test
    fun `an empty amount is ignored rather than sent`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBudgetRepository(mutableListOf(cash))
            val model = BudgetViewModel(repo)
            advanceUntilIdle()

            model.post(cash.id, "deposit", "", "")
            advanceUntilIdle()

            assertEquals(emptyList<String>(), repo.postedAmounts)
        }

    @Test
    fun `a blank account name is not created`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBudgetRepository()
            val model = BudgetViewModel(repo)
            advanceUntilIdle()

            model.addAccount("   ")
            advanceUntilIdle()

            assertEquals(0, repo.accounts.size)
        }

    @Test
    fun `adding an account trims it and reloads`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBudgetRepository()
            val model = BudgetViewModel(repo)
            advanceUntilIdle()

            model.addAccount("  Wallet  ")
            advanceUntilIdle()

            assertEquals(1, model.state.value.accounts.size)
            assertEquals("Wallet", model.state.value.accounts.first().name)
        }
}
