package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetCategory
import com.jackandthings.model.BudgetDue
import com.jackandthings.model.BudgetGoal
import com.jackandthings.model.BudgetGoalDraft
import com.jackandthings.model.BudgetLimitState
import com.jackandthings.model.BudgetReceipt
import com.jackandthings.model.BudgetReport
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.BudgetTransactionDraft

/**
 * The ledger half of Budget, plus issue #5's planning surface.
 *
 * Categories, limits, goals, reports and receipts have no signed-out
 * implementation: they are seeded by the server and a receipt has to live on
 * the server's private disk. The defaults below say so rather than pretending
 * a write succeeded, and [SwitchingBudgetRepository] only reaches them when
 * there is no session. The ledger itself keeps its local signed-out copy.
 */
interface BudgetRepository {
    suspend fun accounts(): Result<List<BudgetAccount>>

    suspend fun createAccount(name: String): Result<BudgetAccount>

    suspend fun deleteAccount(id: String): Result<Unit>

    suspend fun transactions(): Result<List<BudgetTransaction>>

    /**
     * The four-argument form the ledger has always used. Kept so callers that
     * do not care about the issue #5 columns do not have to pass three nulls.
     */
    suspend fun post(
        accountId: String,
        type: String,
        amount: String,
        description: String?,
    ): Result<BudgetTransaction> =
        postTransaction(BudgetTransactionDraft(accountId, type, amount, description))

    /** [BudgetTransactionDraft.amount] stays a string all the way to the server; see JackApi. */
    suspend fun postTransaction(draft: BudgetTransactionDraft): Result<BudgetTransaction> =
        unsupported()

    suspend fun deleteTransaction(id: String): Result<Unit>

    suspend fun transfer(
        fromAccountId: String,
        toAccountId: String,
        amount: String,
        description: String?,
    ): Result<Unit>

    // ── Categories ─────────────────────────────────────────────────────────

    suspend fun categories(): Result<List<BudgetCategory>> = unsupported()

    suspend fun createCategory(name: String, kind: String): Result<BudgetCategory> = unsupported()

    suspend fun updateCategory(id: String, name: String, kind: String): Result<BudgetCategory> =
        unsupported()

    suspend fun deleteCategory(id: String): Result<Unit> = unsupported()

    // ── Limits ─────────────────────────────────────────────────────────────

    /** Caps for one `YYYY-MM` period, with the server's spend already computed. */
    suspend fun limits(period: String): Result<List<BudgetLimitState>> = unsupported()

    /** [limit] is major-unit text; the same category and period edits the existing cap. */
    suspend fun saveLimit(
        categoryId: String,
        period: String,
        limit: String,
    ): Result<BudgetLimitState> = unsupported()

    suspend fun deleteLimit(id: String): Result<Unit> = unsupported()

    // ── Goals ──────────────────────────────────────────────────────────────

    suspend fun goals(): Result<List<BudgetGoal>> = unsupported()

    suspend fun createGoal(draft: BudgetGoalDraft): Result<BudgetGoal> = unsupported()

    suspend fun updateGoal(id: String, draft: BudgetGoalDraft): Result<BudgetGoal> = unsupported()

    suspend fun deleteGoal(id: String): Result<Unit> = unsupported()

    // ── Reports and due state ──────────────────────────────────────────────

    suspend fun report(period: String, months: Int = 6): Result<BudgetReport> = unsupported()

    /** The server sends no notification; this is what the client polls. */
    suspend fun due(period: String): Result<BudgetDue> = unsupported()

    // ── Receipts ───────────────────────────────────────────────────────────

    /**
     * Uploads one receipt image. Multipart is never queued offline - the
     * picker's bytes cannot be held across a restart.
     */
    suspend fun uploadReceipt(
        transactionId: String,
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
    ): Result<BudgetReceipt> = unsupported()

    suspend fun deleteReceipt(id: String): Result<Unit> = unsupported()

    private fun unsupported(): Result<Nothing> = Result.failure(
        UnsupportedOperationException("This needs a signed-in session."),
    )
}

class ApiBudgetRepository(private val api: JackApi) : BudgetRepository {

    override suspend fun accounts(): Result<List<BudgetAccount>> = apiCall { api.budgetAccounts() }

    override suspend fun createAccount(name: String): Result<BudgetAccount> =
        apiCall { api.createBudgetAccount(name) }

    override suspend fun deleteAccount(id: String): Result<Unit> =
        apiCall { api.deleteBudgetAccount(id) }

    override suspend fun transactions(): Result<List<BudgetTransaction>> =
        apiCall { api.budgetTransactions() }

    override suspend fun postTransaction(draft: BudgetTransactionDraft): Result<BudgetTransaction> =
        apiCall {
            api.createTransaction(
                accountId = draft.accountId,
                type = draft.type,
                amount = draft.amount,
                description = draft.description,
                occurredOn = draft.occurredOn,
                merchant = draft.merchant,
                categoryId = draft.categoryId,
            )
        }

    override suspend fun deleteTransaction(id: String): Result<Unit> =
        apiCall { api.deleteTransaction(id) }

    override suspend fun transfer(
        fromAccountId: String,
        toAccountId: String,
        amount: String,
        description: String?,
    ): Result<Unit> = apiCall { api.transfer(fromAccountId, toAccountId, amount, description) }

    override suspend fun categories(): Result<List<BudgetCategory>> =
        apiCall { api.budgetCategories() }

    override suspend fun createCategory(name: String, kind: String): Result<BudgetCategory> =
        apiCall { api.createBudgetCategory(name, kind) }

    override suspend fun updateCategory(
        id: String,
        name: String,
        kind: String,
    ): Result<BudgetCategory> = apiCall { api.updateBudgetCategory(id, name, kind) }

    override suspend fun deleteCategory(id: String): Result<Unit> =
        apiCall { api.deleteBudgetCategory(id) }

    override suspend fun limits(period: String): Result<List<BudgetLimitState>> =
        apiCall { api.budgetLimits(period) }

    override suspend fun saveLimit(
        categoryId: String,
        period: String,
        limit: String,
    ): Result<BudgetLimitState> = apiCall { api.saveBudgetLimit(categoryId, period, limit) }

    override suspend fun deleteLimit(id: String): Result<Unit> =
        apiCall { api.deleteBudgetLimit(id) }

    override suspend fun goals(): Result<List<BudgetGoal>> = apiCall { api.budgetGoals() }

    override suspend fun createGoal(draft: BudgetGoalDraft): Result<BudgetGoal> =
        apiCall { api.createBudgetGoal(draft) }

    override suspend fun updateGoal(id: String, draft: BudgetGoalDraft): Result<BudgetGoal> =
        apiCall { api.updateBudgetGoal(id, draft) }

    override suspend fun deleteGoal(id: String): Result<Unit> = apiCall { api.deleteBudgetGoal(id) }

    override suspend fun report(period: String, months: Int): Result<BudgetReport> =
        apiCall { api.budgetReport(period, months) }

    override suspend fun due(period: String): Result<BudgetDue> = apiCall { api.budgetDue(period) }

    override suspend fun uploadReceipt(
        transactionId: String,
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
    ): Result<BudgetReceipt> =
        apiCall { api.uploadBudgetReceipt(transactionId, bytes, fileName, mimeType) }

    override suspend fun deleteReceipt(id: String): Result<Unit> =
        apiCall { api.deleteBudgetReceipt(id) }
}
