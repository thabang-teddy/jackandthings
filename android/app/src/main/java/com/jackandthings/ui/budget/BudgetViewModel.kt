package com.jackandthings.ui.budget

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.repo.BudgetRepository
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Which composer is open, if any. */
enum class BudgetSheet { None, Account, Transaction, Transfer }

data class BudgetState(
    val accounts: List<BudgetAccount> = emptyList(),
    val transactions: List<BudgetTransaction> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: String? = null,
    val sheet: BudgetSheet = BudgetSheet.None,
) {
    val totalCents: Long get() = accounts.sumOf { it.balanceCents }

    /** A transfer needs somewhere to send money to. */
    val canTransfer: Boolean get() = accounts.size >= 2
}

class BudgetViewModel(private val repo: BudgetRepository) : ViewModel() {

    private val _state = MutableStateFlow(BudgetState())
    val state: StateFlow<BudgetState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            // Balances come from the accounts endpoint, which derives them from
            // the ledger server-side, so there is nothing to total up here
            // beyond summing the accounts.
            val accounts = repo.accounts()
            val transactions = repo.transactions()

            val failure = accounts.exceptionOrNull() ?: transactions.exceptionOrNull()

            _state.update { current ->
                current.copy(
                    accounts = accounts.getOrElse { current.accounts },
                    transactions = transactions.getOrElse { current.transactions },
                    loading = false,
                    error = failure?.readableMessage(),
                )
            }
        }
    }

    fun openSheet(sheet: BudgetSheet) = _state.update { it.copy(sheet = sheet, error = null) }

    fun closeSheet() = _state.update { it.copy(sheet = BudgetSheet.None) }

    fun dismissError() = _state.update { it.copy(error = null) }

    fun addAccount(name: String) {
        if (name.isBlank()) return
        submit { repo.createAccount(name.trim()).map { } }
    }

    fun deleteAccount(id: String) {
        submit { repo.deleteAccount(id) }
    }

    /** [amount] is the text the user typed; the server converts it to cents. */
    fun post(accountId: String, type: String, amount: String, description: String) {
        if (accountId.isBlank() || amount.isBlank()) return
        submit { repo.post(accountId, type, amount, description.ifBlank { null }).map { } }
    }

    fun transfer(fromId: String, toId: String, amount: String, description: String) {
        if (fromId.isBlank() || toId.isBlank() || amount.isBlank()) return
        submit { repo.transfer(fromId, toId, amount, description.ifBlank { null }) }
    }

    fun deleteTransaction(id: String) {
        submit { repo.deleteTransaction(id) }
    }

    /**
     * Every write ends the same way: close the composer and reload, or keep it
     * open with the server's complaint (an overdraft, a duplicate name) shown.
     */
    private fun submit(block: suspend () -> Result<Unit>) {
        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            block().fold(
                onSuccess = {
                    _state.update { it.copy(saving = false, sheet = BudgetSheet.None) }
                    refresh()
                },
                onFailure = { e ->
                    _state.update { it.copy(saving = false, error = e.readableMessage()) }
                },
            )
        }
    }

    companion object {
        fun factory(repo: BudgetRepository) = viewModelFactory {
            initializer { BudgetViewModel(repo) }
        }
    }
}
