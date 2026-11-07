package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetTransaction

class BudgetRepository(private val api: JackApi) {

    suspend fun accounts(): Result<List<BudgetAccount>> = apiCall { api.budgetAccounts() }

    suspend fun createAccount(name: String): Result<BudgetAccount> =
        apiCall { api.createBudgetAccount(name) }

    suspend fun deleteAccount(id: String): Result<Unit> = apiCall { api.deleteBudgetAccount(id) }

    suspend fun transactions(): Result<List<BudgetTransaction>> =
        apiCall { api.budgetTransactions() }

    /** [amount] stays a string all the way to the server; see JackApi. */
    suspend fun post(
        accountId: String,
        type: String,
        amount: String,
        description: String?,
    ): Result<BudgetTransaction> = apiCall {
        api.createTransaction(accountId, type, amount, description)
    }

    suspend fun deleteTransaction(id: String): Result<Unit> =
        apiCall { api.deleteTransaction(id) }

    suspend fun transfer(
        fromAccountId: String,
        toAccountId: String,
        amount: String,
        description: String?,
    ): Result<Unit> = apiCall { api.transfer(fromAccountId, toAccountId, amount, description) }
}
