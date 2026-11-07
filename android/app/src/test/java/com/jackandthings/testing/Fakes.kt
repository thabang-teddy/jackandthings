package com.jackandthings.testing

import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.repo.BudgetRepository
import com.jackandthings.repo.PomodoroRepository

/**
 * Hand-written fakes rather than a mocking framework: they are short, they
 * read as the behaviour being set up, and they break loudly when an interface
 * changes.
 */

class FakePomodoroRepository(
    var presets: MutableList<PomodoroPreset> = mutableListOf(),
) : PomodoroRepository {

    /** Set to make the next call fail, the way a dead network would. */
    var failure: Throwable? = null

    var deletedIds: MutableList<String> = mutableListOf()

    override suspend fun list(): Result<List<PomodoroPreset>> =
        failure?.let { Result.failure(it) } ?: Result.success(presets.toList())

    override suspend fun create(
        name: String,
        focusMinutes: Int,
        breakMinutes: Int,
    ): Result<PomodoroPreset> {
        failure?.let { return Result.failure(it) }

        val preset = PomodoroPreset("id-${presets.size + 1}", name, focusMinutes, breakMinutes)
        presets.add(preset)
        return Result.success(preset)
    }

    override suspend fun delete(id: String): Result<Unit> {
        failure?.let { return Result.failure(it) }

        deletedIds.add(id)
        presets.removeAll { it.id == id }
        return Result.success(Unit)
    }
}

class FakeBudgetRepository(
    var accounts: MutableList<BudgetAccount> = mutableListOf(),
    var transactions: MutableList<BudgetTransaction> = mutableListOf(),
) : BudgetRepository {

    var accountsFailure: Throwable? = null
    var transactionsFailure: Throwable? = null
    var writeFailure: Throwable? = null

    var postedAmounts: MutableList<String> = mutableListOf()
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

        postedAmounts.add(amount)
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

        transfers.add(Triple(fromAccountId, toAccountId, amount))
        return Result.success(Unit)
    }
}
