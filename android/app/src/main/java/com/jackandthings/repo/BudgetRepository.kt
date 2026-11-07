package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetTransaction

interface BudgetRepository {
    suspend fun accounts(): Result<List<BudgetAccount>>

    suspend fun createAccount(name: String): Result<BudgetAccount>

    suspend fun deleteAccount(id: String): Result<Unit>

    suspend fun transactions(): Result<List<BudgetTransaction>>

    /** [amount] stays a string all the way to the server; see JackApi. */
    suspend fun post(
        accountId: String,
        type: String,
        amount: String,
        description: String?,
    ): Result<BudgetTransaction>

    suspend fun deleteTransaction(id: String): Result<Unit>

    suspend fun transfer(
        fromAccountId: String,
        toAccountId: String,
        amount: String,
        description: String?,
    ): Result<Unit>
}

class ApiBudgetRepository(private val api: JackApi) : BudgetRepository {

    override suspend fun accounts(): Result<List<BudgetAccount>> = apiCall { api.budgetAccounts() }

    override suspend fun createAccount(name: String): Result<BudgetAccount> =
        apiCall { api.createBudgetAccount(name) }

    override suspend fun deleteAccount(id: String): Result<Unit> =
        apiCall { api.deleteBudgetAccount(id) }

    override suspend fun transactions(): Result<List<BudgetTransaction>> =
        apiCall { api.budgetTransactions() }

    override suspend fun post(
        accountId: String,
        type: String,
        amount: String,
        description: String?,
    ): Result<BudgetTransaction> = apiCall {
        api.createTransaction(accountId, type, amount, description)
    }

    override suspend fun deleteTransaction(id: String): Result<Unit> =
        apiCall { api.deleteTransaction(id) }

    override suspend fun transfer(
        fromAccountId: String,
        toAccountId: String,
        amount: String,
        description: String?,
    ): Result<Unit> = apiCall { api.transfer(fromAccountId, toAccountId, amount, description) }
}
