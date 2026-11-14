package com.jackandthings.ui.budget

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.budget.BudgetRules
import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetBill
import com.jackandthings.model.BudgetCategory
import com.jackandthings.model.BudgetGoal
import com.jackandthings.model.BudgetLimitState
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.repo.centsToAmountString
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold
import com.jackandthings.ui.common.formatZar
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

/** The four image types the server accepts; anything else is refused there. */
private val ACCEPTED_MIME = setOf("image/jpeg", "image/png", "image/webp", "image/heic")

/** The money typed only ever moves as text; no float touches an amount. */
private fun amountFilter(value: String) = value.filter { it.isDigit() || it == '.' }

private fun periodLabel(period: String): String = runCatching {
    YearMonth.parse(period)
        .format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.Builder().setLanguage("en").setRegion("ZA").build()))
}.getOrDefault(period)

@Composable
fun BudgetScreen(viewModel: BudgetViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    ModuleScaffold(title = "Budget", onBack = onBack) { padding ->
        when {
            state.loading -> LoadingBox(Modifier.padding(padding))

            else -> Column(Modifier.fillMaxSize().padding(padding)) {
                BudgetTabs(
                    selected = state.tab,
                    onSelect = viewModel::selectTab,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    state.error?.let { message ->
                        item(key = "error") {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.weight(1f)) { ErrorCard(message) }
                                TextButton(onClick = viewModel::dismissError) { Text("Dismiss") }
                            }
                        }
                    }

                    when (state.tab) {
                        BudgetTab.Overview -> overview(state, viewModel)
                        BudgetTab.Categories -> categories(state, viewModel)
                        BudgetTab.Limits -> limits(state, viewModel)
                        BudgetTab.Goals -> goals(state, viewModel)
                        BudgetTab.Reports -> reports(state, viewModel)
                    }
                }
            }
        }
    }

    when (state.sheet) {
        BudgetSheet.None -> Unit

        BudgetSheet.Account -> AddAccountDialog(
            saving = state.saving,
            onDismiss = viewModel::closeSheet,
            onSave = viewModel::addAccount,
        )

        BudgetSheet.Transaction -> TransactionDialog(
            accounts = state.accounts,
            categories = state.categories,
            saving = state.saving,
            onDismiss = viewModel::closeSheet,
            onSave = viewModel::post,
        )

        BudgetSheet.Transfer -> TransferDialog(
            accounts = state.accounts,
            saving = state.saving,
            onDismiss = viewModel::closeSheet,
            onSave = viewModel::transfer,
        )

        BudgetSheet.Category -> {
            val editing = state.editingCategory
            CategoryDialog(
                category = editing,
                saving = state.saving,
                onDismiss = viewModel::closeSheet,
                onSave = { name, kind ->
                    if (editing == null) {
                        viewModel.addCategory(name, kind)
                    } else {
                        viewModel.updateCategory(editing.id, name, kind)
                    }
                },
            )
        }

        BudgetSheet.Limit -> LimitDialog(
            limit = state.editingLimit,
            categories = state.expenseCategories,
            period = state.period,
            saving = state.saving,
            onDismiss = viewModel::closeSheet,
            onSave = viewModel::saveLimit,
        )

        BudgetSheet.Goal -> GoalDialog(
            saving = state.saving,
            onDismiss = viewModel::closeSheet,
            onSave = viewModel::addGoal,
        )
    }
}

@Composable
private fun BudgetTabs(
    selected: BudgetTab,
    onSelect: (BudgetTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    val labels = listOf(
        BudgetTab.Overview to "Overview",
        BudgetTab.Categories to "Categories",
        BudgetTab.Limits to "Limits",
        BudgetTab.Goals to "Goals",
        BudgetTab.Reports to "Reports",
    )

    Row(
        modifier = modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        labels.forEach { (tab, label) ->
            FilterChip(
                selected = selected == tab,
                onClick = { onSelect(tab) },
                label = { Text(label, maxLines = 1) },
            )
        }
    }
}

// ── Overview ───────────────────────────────────────────────────────────────

private fun androidx.compose.foundation.lazy.LazyListScope.overview(
    state: BudgetState,
    viewModel: BudgetViewModel,
) {
    item(key = "total") {
        Card {
            Column(Modifier.padding(16.dp)) {
                Text(
                    "Across all accounts",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(formatZar(state.totalCents), style = MaterialTheme.typography.headlineMedium)
            }
        }
    }

    state.due?.takeUnless { it.isEmpty }?.let { due ->
        item(key = "due") { DueCard(due) }
    }

    items(state.accounts, key = { "account-${it.id}" }) { account ->
        Card {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(account.name, style = MaterialTheme.typography.titleMedium)
                    Text(formatZar(account.balanceCents), style = MaterialTheme.typography.titleLarge)
                }
                IconButton(onClick = { viewModel.deleteAccount(account.id) }) {
                    Icon(Icons.Filled.Delete, contentDescription = "Delete account")
                }
            }
        }
    }

    if (state.accounts.isEmpty()) {
        item(key = "no-accounts") {
            EmptyState(
                title = "No accounts yet",
                description = "Add one to start tracking money.",
            )
        }
    }

    item(key = "actions") {
        // Equal weights and a single line each: at three buttons the longest
        // label otherwise wraps mid-word on a phone.
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedButton(
                onClick = { viewModel.openSheet(BudgetSheet.Account) },
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
                modifier = Modifier.weight(1f),
            ) {
                Text("Account", maxLines = 1, style = MaterialTheme.typography.labelLarge)
            }
            OutlinedButton(
                onClick = { viewModel.openSheet(BudgetSheet.Transaction) },
                enabled = state.accounts.isNotEmpty(),
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
                modifier = Modifier.weight(1f),
            ) {
                Text("Transaction", maxLines = 1, style = MaterialTheme.typography.labelLarge)
            }
            OutlinedButton(
                onClick = { viewModel.openSheet(BudgetSheet.Transfer) },
                enabled = state.canTransfer,
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
                modifier = Modifier.weight(1f),
            ) {
                Text("Transfer", maxLines = 1, style = MaterialTheme.typography.labelLarge)
            }
        }
    }

    if (state.transactions.isNotEmpty()) {
        item(key = "activity-title") {
            Text(
                "Recent activity",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }

    items(state.transactions, key = { "tx-${it.id}" }) { transaction ->
        TransactionCard(
            transaction = transaction,
            uploading = state.uploadingReceiptFor == transaction.id,
            onDelete = { viewModel.deleteTransaction(transaction.id) },
            onUploadReceipt = { bytes, fileName, mime ->
                viewModel.uploadReceipt(transaction.id, bytes, fileName, mime)
            },
            onDeleteReceipt = { receiptId -> viewModel.deleteReceipt(receiptId) },
        )
    }
}

@Composable
private fun DueCard(due: com.jackandthings.model.BudgetDue) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
        ),
    ) {
        Column(
            Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text("Needs attention", style = MaterialTheme.typography.titleSmall)

            due.bills.forEach { bill -> BillRow(bill) }

            due.limits.forEach { limit ->
                Text(
                    "${limit.category}: ${formatZar(limit.spentCents)} of " +
                        "${formatZar(limit.limitCents)} (${limit.percent}%)",
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            Text(
                "Your phone checks these; the server never sends a notification.",
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

@Composable
private fun BillRow(bill: BudgetBill) {
    val whenDue = bill.daysUntilDue?.let { days ->
        when {
            days < 0 -> "overdue"
            days == 0 -> "due today"
            days == 1 -> "due tomorrow"
            else -> "in $days days"
        }
    } ?: "no date"

    Text(
        "${bill.description ?: "Bill"} · ${formatZar(bill.amountCents)} · $whenDue",
        style = MaterialTheme.typography.bodySmall,
    )
}

@Composable
private fun TransactionCard(
    transaction: BudgetTransaction,
    uploading: Boolean,
    onDelete: () -> Unit,
    onUploadReceipt: (ByteArray, String, String) -> Unit,
    onDeleteReceipt: (String) -> Unit,
) {
    val context = LocalContext.current

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult

        val resolver = context.contentResolver
        val mime = resolver.getType(uri) ?: "image/jpeg"
        if (mime !in ACCEPTED_MIME) return@rememberLauncherForActivityResult

        val name = resolver.query(uri, null, null, null, null)?.use { cursor ->
            val column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (column >= 0 && cursor.moveToFirst()) cursor.getString(column) else null
        } ?: "receipt"

        val bytes = runCatching {
            resolver.openInputStream(uri)?.use { it.readBytes() }
        }.getOrNull() ?: return@rememberLauncherForActivityResult

        onUploadReceipt(bytes, name, mime)
    }

    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(transaction.label, style = MaterialTheme.typography.titleSmall)
                    Text(
                        transaction.flowLabel,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    listOfNotNull(
                        transaction.merchant,
                        transaction.category,
                        transaction.occurredOn,
                        transaction.description?.takeIf { it.isNotBlank() },
                    ).forEach { line ->
                        Text(line, style = MaterialTheme.typography.bodySmall)
                    }
                }
                Text(
                    text = (if (transaction.isCredit) "+" else "−") +
                        formatZar(transaction.amountCents),
                    style = MaterialTheme.typography.titleMedium,
                )
                IconButton(onClick = onDelete) {
                    Icon(Icons.Filled.Delete, contentDescription = "Remove")
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = when {
                        transaction.receipt != null -> "Receipt attached"
                        uploading -> "Uploading receipt…"
                        else -> "No receipt"
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )

                transaction.receipt?.let { receipt ->
                    TextButton(onClick = { onDeleteReceipt(receipt.id) }) { Text("Remove") }
                }

                TextButton(
                    enabled = !uploading,
                    onClick = {
                        picker.launch(
                            PickVisualMediaRequest(
                                ActivityResultContracts.PickVisualMedia.ImageOnly,
                            ),
                        )
                    },
                ) {
                    Text(if (transaction.receipt == null) "Attach" else "Replace")
                }
            }
        }
    }
}

// ── Categories ─────────────────────────────────────────────────────────────

private fun androidx.compose.foundation.lazy.LazyListScope.categories(
    state: BudgetState,
    viewModel: BudgetViewModel,
) {
    item(key = "category-actions") {
        OutlinedButton(onClick = { viewModel.openSheet(BudgetSheet.Category) }) {
            Text("Add category")
        }
    }

    if (state.categories.isEmpty()) {
        item(key = "no-categories") {
            EmptyState(
                title = "No categories yet",
                description = "They are created with your account; add one if you want your own.",
            )
        }
    }

    items(state.categories, key = { "category-${it.id}" }) { category ->
        Card {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(category.name, style = MaterialTheme.typography.titleMedium)
                    Text(
                        category.kindLabel.ifBlank { if (category.isIncome) "Income" else "Expense" },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                TextButton(onClick = { viewModel.editCategory(category) }) { Text("Rename") }
                IconButton(onClick = { viewModel.deleteCategory(category.id) }) {
                    Icon(Icons.Filled.Delete, contentDescription = "Delete category")
                }
            }
        }
    }
}

// ── Limits ─────────────────────────────────────────────────────────────────

private fun androidx.compose.foundation.lazy.LazyListScope.limits(
    state: BudgetState,
    viewModel: BudgetViewModel,
) {
    item(key = "limit-actions") {
        PeriodBar(
            period = state.period,
            onShift = viewModel::shiftPeriod,
            onAdd = { viewModel.openSheet(BudgetSheet.Limit) },
        )
    }

    if (state.limits.isEmpty()) {
        item(key = "no-limits") {
            EmptyState(
                title = "No caps for ${periodLabel(state.period)}",
                description = "A cap tracks one expense category for the month.",
            )
        }
    }

    items(state.limits, key = { "limit-${it.id}" }) { limit ->
        LimitCard(
            limit,
            onEdit = { viewModel.editLimit(limit) },
            onDelete = { viewModel.deleteLimit(limit.id) },
        )
    }
}

@Composable
private fun PeriodBar(period: String, onShift: (Int) -> Unit, onAdd: (() -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        TextButton(onClick = { onShift(-1) }) { Text("‹") }
        Text(
            periodLabel(period),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.weight(1f),
        )
        onAdd?.let { TextButton(onClick = it) { Text("Add") } }
        TextButton(onClick = { onShift(1) }) { Text("›") }
    }
}

@Composable
private fun LimitCard(limit: BudgetLimitState, onEdit: () -> Unit, onDelete: () -> Unit) {
    val meterColor = when (limit.state) {
        BudgetRules.STATE_OVER -> MaterialTheme.colorScheme.error
        BudgetRules.STATE_NEAR -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.primary
    }

    Card {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(limit.category, style = MaterialTheme.typography.titleMedium)
                    Text(
                        "${formatZar(limit.spentCents)} of ${formatZar(limit.limitCents)}",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Text("${limit.percent}%", style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = onEdit) { Text("Edit") }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Filled.Delete, contentDescription = "Delete cap")
                }
            }
            Meter(fraction = limit.percent / 100f, color = meterColor)
        }
    }
}

// ── Goals ──────────────────────────────────────────────────────────────────

private fun androidx.compose.foundation.lazy.LazyListScope.goals(
    state: BudgetState,
    viewModel: BudgetViewModel,
) {
    item(key = "goal-actions") {
        OutlinedButton(onClick = { viewModel.openSheet(BudgetSheet.Goal) }) {
            Text("Add goal")
        }
    }

    if (state.goals.isEmpty()) {
        item(key = "no-goals") {
            EmptyState(
                title = "No goals yet",
                description = "A goal is a savings jar you measure yourself against.",
            )
        }
    }

    items(state.goals, key = { "goal-${it.id}" }) { goal ->
        GoalCard(goal, onDelete = { viewModel.deleteGoal(goal.id) })
    }
}

@Composable
private fun GoalCard(goal: BudgetGoal, onDelete: () -> Unit) {
    Card {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(goal.name, style = MaterialTheme.typography.titleMedium)
                    Text(
                        "${formatZar(goal.savedCents)} of ${formatZar(goal.targetCents)}" +
                            if (goal.complete) " · reached" else "",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Text("${goal.percent}%", style = MaterialTheme.typography.titleMedium)
                IconButton(onClick = onDelete) {
                    Icon(Icons.Filled.Delete, contentDescription = "Delete goal")
                }
            }
            Meter(
                fraction = goal.percent / 100f,
                color = if (goal.complete) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.secondary
                },
            )
            goal.targetDate?.let { date ->
                Text("Target date $date", style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

// ── Reports ────────────────────────────────────────────────────────────────

private fun androidx.compose.foundation.lazy.LazyListScope.reports(
    state: BudgetState,
    viewModel: BudgetViewModel,
) {
    item(key = "report-period") {
        PeriodBar(period = state.period, onShift = viewModel::shiftPeriod)
    }

    val report = state.report

    when {
        state.reportLoading -> item(key = "report-loading") { Text("Loading report…") }

        state.reportError != null -> state.reportError?.let { message ->
            item(key = "report-error") { ErrorCard(message) }
        }

        report == null -> item(key = "no-report") {
            EmptyState(
                title = "No report yet",
                description = "Reports need a signed-in session.",
            )
        }

        else -> {
            item(key = "in-out") {
                Card {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Income vs expenses", style = MaterialTheme.typography.titleSmall)
                        val peak = report.monthly.maxOfOrNull {
                            maxOf(it.incomeCents, it.expenseCents)
                        }?.coerceAtLeast(1) ?: 1
                        report.monthly.forEach { month ->
                            MonthBars(
                                label = month.period,
                                incomeCents = month.incomeCents,
                                expenseCents = month.expenseCents,
                                peakCents = peak,
                            )
                        }
                    }
                }
            }

            item(key = "by-category") {
                Card {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("By category", style = MaterialTheme.typography.titleSmall)
                        if (report.categories.isEmpty()) {
                            Text("Nothing recorded for ${periodLabel(report.period)}.")
                        }
                        report.categories.forEach { bucket ->
                            val cents = if (bucket.kind == "income") bucket.incomeCents else bucket.spentCents
                            Text(
                                "${bucket.name} · ${formatZar(cents)}",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                }
            }

            item(key = "net-worth") {
                Card {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Net worth", style = MaterialTheme.typography.titleSmall)
                        report.netWorth.forEach { point ->
                            Text(
                                "${point.period} · ${formatZar(point.netCents)}",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MonthBars(
    label: String,
    incomeCents: Long,
    expenseCents: Long,
    peakCents: Long,
) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.labelSmall)
        Meter(
            fraction = (incomeCents.toFloat() / peakCents).coerceIn(0f, 1f),
            color = MaterialTheme.colorScheme.primary,
        )
        Meter(
            fraction = (expenseCents.toFloat() / peakCents).coerceIn(0f, 1f),
            color = MaterialTheme.colorScheme.error,
        )
        Text(
            "in ${formatZar(incomeCents)} · out ${formatZar(expenseCents)}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** Hand-rolled bar: no chart library ships with this app. */
@Composable
private fun Meter(fraction: Float, color: Color) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(6.dp)
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(3.dp)),
    ) {
        Box(
            Modifier
                .fillMaxWidth(fraction.coerceIn(0f, 1f))
                .height(6.dp)
                .background(color, RoundedCornerShape(3.dp)),
        )
    }
}

// ── Dialogs ────────────────────────────────────────────────────────────────

@Composable
private fun AddAccountDialog(
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
) {
    var name by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New account") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                placeholder = { Text("Cash, Savings…") },
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(name) },
                enabled = name.isNotBlank() && !saving,
            ) { Text(if (saving) "Saving…" else "Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun TransactionDialog(
    accounts: List<BudgetAccount>,
    categories: List<BudgetCategory>,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String, String, String, String, String, String?) -> Unit,
) {
    var accountId by remember { mutableStateOf(accounts.firstOrNull()?.id.orEmpty()) }
    var type by remember { mutableStateOf("deposit") }
    var amount by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var merchant by remember { mutableStateOf("") }
    var occurredOn by remember { mutableStateOf(LocalDate.now().toString()) }
    var categoryId by remember { mutableStateOf("") }

    val matching = categories.filter { it.isIncome == (type == "deposit") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add transaction") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                AccountPicker("Account", accounts, accountId) { accountId = it }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    listOf("deposit" to "Deposit", "withdrawal" to "Withdrawal")
                        .forEach { (value, label) ->
                            Row(
                                modifier = Modifier.selectable(
                                    selected = type == value,
                                    onClick = {
                                        type = value
                                        // An income bucket cannot collect a
                                        // withdrawal; reset the pick when the
                                        // side of the ledger changes.
                                        categoryId = ""
                                    },
                                ),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(
                                    selected = type == value,
                                    onClick = { type = value; categoryId = "" },
                                )
                                Text(label)
                            }
                        }
                }

                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = amountFilter(it) },
                    label = { Text("Amount (ZAR)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = occurredOn,
                    onValueChange = { occurredOn = it },
                    label = { Text("Date (YYYY-MM-DD)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = merchant,
                    onValueChange = { merchant = it },
                    label = { Text("Merchant (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                if (matching.isNotEmpty()) {
                    Text("Category", style = MaterialTheme.typography.labelMedium)
                    matching.forEach { category ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .selectable(
                                    selected = categoryId == category.id,
                                    onClick = {
                                        categoryId = if (categoryId == category.id) "" else category.id
                                    },
                                ),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = categoryId == category.id,
                                onClick = {
                                    categoryId = if (categoryId == category.id) "" else category.id
                                },
                            )
                            Text(category.name)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(accountId, type, amount, description, occurredOn, merchant, categoryId.ifBlank { null })
                },
                enabled = amount.isNotBlank() && accountId.isNotBlank() && !saving,
            ) { Text(if (saving) "Posting…" else "Post") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun TransferDialog(
    accounts: List<BudgetAccount>,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String, String, String) -> Unit,
) {
    var fromId by remember { mutableStateOf(accounts.firstOrNull()?.id.orEmpty()) }
    var toId by remember { mutableStateOf(accounts.getOrNull(1)?.id.orEmpty()) }
    var amount by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Transfer money") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AccountPicker("From", accounts, fromId) { fromId = it }
                AccountPicker("To", accounts, toId) { toId = it }
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = amountFilter(it) },
                    label = { Text("Amount (ZAR)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(fromId, toId, amount, description) },
                // The server rejects a same-account transfer; blocking it here
                // saves a round trip.
                enabled = amount.isNotBlank() && fromId != toId && !saving,
            ) { Text(if (saving) "Transferring…" else "Transfer") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun CategoryDialog(
    category: BudgetCategory?,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit,
) {
    var name by remember { mutableStateOf(category?.name.orEmpty()) }
    var kind by remember { mutableStateOf(category?.kind ?: "expense") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (category == null) "New category" else "Rename category") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    listOf("expense" to "Expense", "income" to "Income").forEach { (value, label) ->
                        Row(
                            modifier = Modifier.selectable(
                                selected = kind == value,
                                onClick = { kind = value },
                            ),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(selected = kind == value, onClick = { kind = value })
                            Text(label)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = name.isNotBlank() && !saving,
                onClick = { onSave(name, kind) },
            ) { Text(if (saving) "Saving…" else "Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun LimitDialog(
    limit: BudgetLimitState?,
    categories: List<BudgetCategory>,
    period: String,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit,
) {
    var categoryId by remember { mutableStateOf(limit?.categoryId ?: categories.firstOrNull()?.id.orEmpty()) }
    var amount by remember {
        mutableStateOf(limit?.limitCents?.centsToAmountString().orEmpty())
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Cap for ${periodLabel(period)}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Expense category", style = MaterialTheme.typography.labelMedium)
                categories.forEach { category ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = categoryId == category.id,
                                onClick = { categoryId = category.id },
                            ),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = categoryId == category.id,
                            onClick = { categoryId = category.id },
                        )
                        Text(category.name)
                    }
                }

                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = amountFilter(it) },
                    label = { Text("Limit (ZAR)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = categoryId.isNotBlank() && amount.isNotBlank() && !saving,
                onClick = { onSave(categoryId, amount) },
            ) { Text(if (saving) "Saving…" else "Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun GoalDialog(
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String, String) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var target by remember { mutableStateOf("") }
    var saved by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New goal") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    placeholder = { Text("Holiday, Emergency fund…") },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = target,
                    onValueChange = { target = amountFilter(it) },
                    label = { Text("Target (ZAR)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                OutlinedTextField(
                    value = saved,
                    onValueChange = { saved = amountFilter(it) },
                    label = { Text("Saved so far (optional)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = name.isNotBlank() && target.isNotBlank() && !saving,
                onClick = { onSave(name, target, saved) },
            ) { Text(if (saving) "Saving…" else "Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun AccountPicker(
    label: String,
    accounts: List<BudgetAccount>,
    selectedId: String,
    onSelect: (String) -> Unit,
) {
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium)
        accounts.forEach { account ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .selectable(
                        selected = account.id == selectedId,
                        onClick = { onSelect(account.id) },
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(
                    selected = account.id == selectedId,
                    onClick = { onSelect(account.id) },
                )
                Text("${account.name} · ${formatZar(account.balanceCents)}")
            }
        }
    }
}
