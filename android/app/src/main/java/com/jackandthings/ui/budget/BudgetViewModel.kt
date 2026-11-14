package com.jackandthings.ui.budget

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.budget.BudgetRules
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetCategory
import com.jackandthings.model.BudgetDue
import com.jackandthings.model.BudgetGoal
import com.jackandthings.model.BudgetGoalDraft
import com.jackandthings.model.BudgetLimitState
import com.jackandthings.model.BudgetReport
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.BudgetTransactionDraft
import com.jackandthings.repo.BudgetRepository
import com.jackandthings.repo.readableMessage
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Which composer is open, if any. */
enum class BudgetSheet { None, Account, Transaction, Transfer, Category, Limit, Goal }

/** The screen's sections. One screen with tabs keeps the ledger and its planning together. */
enum class BudgetTab { Overview, Categories, Limits, Goals, Reports }

data class BudgetState(
    val accounts: List<BudgetAccount> = emptyList(),
    val transactions: List<BudgetTransaction> = emptyList(),
    val categories: List<BudgetCategory> = emptyList(),
    val limits: List<BudgetLimitState> = emptyList(),
    val goals: List<BudgetGoal> = emptyList(),
    val report: BudgetReport? = null,
    val due: BudgetDue? = null,
    val period: String = BudgetRules.monthOf(LocalDate.now().toString()),
    val tab: BudgetTab = BudgetTab.Overview,
    val loading: Boolean = true,
    val saving: Boolean = false,
    val reportLoading: Boolean = false,
    val reportError: String? = null,
    val error: String? = null,
    val sheet: BudgetSheet = BudgetSheet.None,
    /** The row being edited, when a sheet was opened from an existing one. */
    val editingCategory: BudgetCategory? = null,
    val editingLimit: BudgetLimitState? = null,
    /** The transaction whose receipt is uploading, so only its row says so. */
    val uploadingReceiptFor: String? = null,
) {
    val totalCents: Long get() = accounts.sumOf { it.balanceCents }

    /** A transfer needs somewhere to send money to. */
    val canTransfer: Boolean get() = accounts.size >= 2

    val expenseCategories: List<BudgetCategory> get() = categories.filterNot { it.isIncome }

    val incomeCategories: List<BudgetCategory> get() = categories.filter { it.isIncome }
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
            val categories = repo.categories()
            val goals = repo.goals()
            val limits = repo.limits(_state.value.period)

            // Categories are seeded server-side, so their failure is the one
            // that tells us planning is unavailable (a signed-out session has
            // no planning half at all). Limits and due state are best effort:
            // they are online-only, and one failing should not blank a ledger
            // that is already on screen.
            val planningError = categories.exceptionOrNull()
            val failure = accounts.exceptionOrNull()
                ?: transactions.exceptionOrNull()
                ?: planningError?.takeUnless { it is UnsupportedOperationException }

            _state.update { current ->
                current.copy(
                    accounts = accounts.getOrElse { current.accounts },
                    transactions = transactions.getOrElse { current.transactions },
                    categories = categories.getOrElse { current.categories },
                    goals = goals.getOrElse { current.goals },
                    limits = limits.getOrElse { current.limits },
                    loading = false,
                    error = failure?.readableMessage(),
                )
            }

            loadDue()
        }
    }

    fun selectTab(tab: BudgetTab) {
        _state.update { it.copy(tab = tab, error = null) }

        if (tab == BudgetTab.Reports) {
            loadReport()
        }
    }

    /** Moves the month the caps and reports cover, not the ledger's history. */
    fun shiftPeriod(delta: Int) {
        val next = BudgetRules.shiftPeriod(_state.value.period, delta)
        _state.update { it.copy(period = next) }
        loadLimits()
        loadDue()

        if (_state.value.report != null) {
            loadReport()
        }
    }

    fun openSheet(sheet: BudgetSheet) =
        _state.update { it.copy(sheet = sheet, error = null, editingCategory = null, editingLimit = null) }

    fun editCategory(category: BudgetCategory) = _state.update {
        it.copy(sheet = BudgetSheet.Category, error = null, editingCategory = category)
    }

    fun editLimit(limit: BudgetLimitState) = _state.update {
        it.copy(sheet = BudgetSheet.Limit, error = null, editingLimit = limit)
    }

    fun closeSheet() = _state.update {
        it.copy(
            sheet = BudgetSheet.None,
            editingCategory = null,
            editingLimit = null,
        )
    }

    fun dismissError() = _state.update { it.copy(error = null) }

    fun addAccount(name: String) {
        if (name.isBlank()) return
        submit { repo.createAccount(name.trim()).map { } }
    }

    fun deleteAccount(id: String) {
        submit { repo.deleteAccount(id) }
    }

    /** [amount] is the text the user typed; the server converts it to cents. */
    fun post(
        accountId: String,
        type: String,
        amount: String,
        description: String,
        occurredOn: String = LocalDate.now().toString(),
        merchant: String = "",
        categoryId: String? = null,
    ) {
        if (accountId.isBlank() || amount.isBlank()) return

        val draft = BudgetTransactionDraft(
            accountId = accountId,
            type = type,
            amount = amount,
            description = description.ifBlank { null },
            occurredOn = occurredOn.takeIf { it.isNotBlank() },
            merchant = merchant.trim().ifBlank { null },
            categoryId = categoryId?.takeIf { it.isNotBlank() },
        )

        submit { repo.postTransaction(draft).map { } }
    }

    fun transfer(fromId: String, toId: String, amount: String, description: String) {
        if (fromId.isBlank() || toId.isBlank() || amount.isBlank()) return
        submit { repo.transfer(fromId, toId, amount, description.ifBlank { null }) }
    }

    fun deleteTransaction(id: String) {
        submit { repo.deleteTransaction(id) }
    }

    // ── Categories ─────────────────────────────────────────────────────────

    fun addCategory(name: String, kind: String) {
        if (name.isBlank()) return
        submit { repo.createCategory(name.trim(), kind).map { } }
    }

    fun updateCategory(id: String, name: String, kind: String) {
        if (name.isBlank()) return
        submit { repo.updateCategory(id, name.trim(), kind).map { } }
    }

    fun deleteCategory(id: String) {
        submit { repo.deleteCategory(id) }
    }

    // ── Limits ─────────────────────────────────────────────────────────────

    /** [limit] is the text typed; the server converts it to cents. */
    fun saveLimit(categoryId: String, limit: String) {
        if (categoryId.isBlank() || limit.isBlank()) return
        submit { repo.saveLimit(categoryId, _state.value.period, limit).map { } }
    }

    fun deleteLimit(id: String) {
        submit { repo.deleteLimit(id) }
    }

    // ── Goals ──────────────────────────────────────────────────────────────

    fun addGoal(name: String, target: String, saved: String) {
        if (name.isBlank() || target.isBlank()) return

        submit {
            repo.createGoal(
                BudgetGoalDraft(
                    name = name.trim(),
                    target = target,
                    saved = saved.ifBlank { null },
                ),
            ).map { }
        }
    }

    fun deleteGoal(id: String) {
        submit { repo.deleteGoal(id) }
    }

    // ── Receipts ───────────────────────────────────────────────────────────

    /**
     * The picked image arrives as bytes, so this ViewModel and its repository
     * stay free of Context. Nothing is written to app storage first.
     */
    fun uploadReceipt(transactionId: String, bytes: ByteArray, fileName: String, mimeType: String) {
        _state.update { it.copy(uploadingReceiptFor = transactionId, error = null) }
        viewModelScope.launch {
            repo.uploadReceipt(transactionId, bytes, fileName, mimeType).fold(
                onSuccess = {
                    _state.update { current -> current.copy(uploadingReceiptFor = null) }
                    refresh()
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(uploadingReceiptFor = null, error = e.readableMessage())
                    }
                },
            )
        }
    }

    fun deleteReceipt(id: String) {
        submit { repo.deleteReceipt(id) }
    }

    // ── Reads ──────────────────────────────────────────────────────────────

    private fun loadLimits() {
        val period = _state.value.period
        viewModelScope.launch {
            val limits = repo.limits(period)
            _state.update { current ->
                if (current.period != period) {
                    current
                } else {
                    current.copy(limits = limits.getOrElse { current.limits })
                }
            }
        }
    }

    private fun loadDue() {
        val period = _state.value.period
        viewModelScope.launch {
            val due = repo.due(period)
            _state.update { current ->
                if (current.period != period) {
                    current
                } else {
                    current.copy(due = due.getOrNull() ?: current.due)
                }
            }
        }
    }

    private fun loadReport() {
        val period = _state.value.period
        _state.update { it.copy(reportLoading = true, reportError = null) }
        viewModelScope.launch {
            val report = repo.report(period)
            _state.update { current ->
                current.copy(
                    report = report.getOrElse { current.report },
                    reportLoading = false,
                    reportError = report.exceptionOrNull()?.readableMessage(),
                )
            }
        }
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
                    _state.update {
                        it.copy(
                            saving = false,
                            sheet = BudgetSheet.None,
                            editingCategory = null,
                            editingLimit = null,
                        )
                    }
                    refresh()
                    if (_state.value.report != null) loadReport()
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
