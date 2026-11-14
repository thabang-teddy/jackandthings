package com.jackandthings.repo

import com.jackandthings.data.local.JsonFileStore
import com.jackandthings.data.local.PendingTransfer
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.BudgetTransactionDraft
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * Backs the Budget module while there is no signed-in session to post to.
 *
 * Balances are derived from the transaction list on every read rather than
 * stored, the same way the server computes them from its ledger. A transfer
 * also records a [PendingTransfer] alongside its two display rows, since
 * that - not the rows - is what [SyncManager] replays as a single call.
 */
class LocalBudgetRepository(
    private val accounts: JsonFileStore<BudgetAccount>,
    private val transactions: JsonFileStore<BudgetTransaction>,
    private val transfers: JsonFileStore<PendingTransfer>,
) : BudgetRepository {

    override suspend fun accounts(): Result<List<BudgetAccount>> {
        val txns = transactions.read()
        val withBalances = accounts.read().map { account ->
            val balance = txns.filter { it.accountId == account.id }
                .sumOf { if (it.isCredit) it.amountCents else -it.amountCents }
            account.copy(balanceCents = balance)
        }
        return Result.success(withBalances)
    }

    override suspend fun createAccount(name: String): Result<BudgetAccount> {
        val account = BudgetAccount(id = UUID.randomUUID().toString(), name = name, balanceCents = 0)
        accounts.write(accounts.read() + account)
        return Result.success(account)
    }

    override suspend fun deleteAccount(id: String): Result<Unit> {
        accounts.write(accounts.read().filterNot { it.id == id })
        return Result.success(Unit)
    }

    override suspend fun transactions(): Result<List<BudgetTransaction>> =
        Result.success(transactions.read())

    override suspend fun postTransaction(
        draft: BudgetTransactionDraft,
    ): Result<BudgetTransaction> {
        val account = accounts.read().find { it.id == draft.accountId }
            ?: return Result.failure(IllegalArgumentException("Account not found"))
        val cents = draft.amount.amountStringToCentsOrNull()
            ?: return Result.failure(
                IllegalArgumentException("\"${draft.amount}\" is not a valid amount"),
            )

        val txn = BudgetTransaction(
            id = UUID.randomUUID().toString(),
            type = draft.type,
            amountCents = cents,
            description = draft.description,
            accountId = account.id,
            account = account.name,
            categoryId = draft.categoryId,
            occurredOn = draft.occurredOn ?: LocalDate.now().toString(),
            merchant = draft.merchant,
            createdAt = Instant.now().toString(),
        )
        transactions.write(transactions.read() + txn)
        return Result.success(txn)
    }

    override suspend fun deleteTransaction(id: String): Result<Unit> {
        transactions.write(transactions.read().filterNot { it.id == id })
        return Result.success(Unit)
    }

    override suspend fun transfer(
        fromAccountId: String,
        toAccountId: String,
        amount: String,
        description: String?,
    ): Result<Unit> {
        val all = accounts.read()
        val from = all.find { it.id == fromAccountId }
            ?: return Result.failure(IllegalArgumentException("Source account not found"))
        val to = all.find { it.id == toAccountId }
            ?: return Result.failure(IllegalArgumentException("Destination account not found"))
        val cents = amount.amountStringToCentsOrNull()
            ?: return Result.failure(IllegalArgumentException("\"$amount\" is not a valid amount"))

        val now = Instant.now().toString()
        val today = LocalDate.now().toString()
        val out = BudgetTransaction(
            id = UUID.randomUUID().toString(),
            type = "transfer_out",
            amountCents = cents,
            description = description,
            accountId = from.id,
            account = from.name,
            relatedAccountId = to.id,
            relatedAccount = to.name,
            occurredOn = today,
            createdAt = now,
        )
        val inbound = BudgetTransaction(
            id = UUID.randomUUID().toString(),
            type = "transfer_in",
            amountCents = cents,
            description = description,
            accountId = to.id,
            account = to.name,
            relatedAccountId = from.id,
            relatedAccount = from.name,
            occurredOn = today,
            createdAt = now,
        )
        transactions.write(transactions.read() + out + inbound)
        transfers.write(
            transfers.read() + PendingTransfer(
                id = UUID.randomUUID().toString(),
                fromAccountId = from.id,
                toAccountId = to.id,
                amountCents = cents,
                description = description,
            ),
        )
        return Result.success(Unit)
    }
}
