package com.jackandthings.ui.budget

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.model.BudgetAccount
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold
import com.jackandthings.ui.common.formatZar

@Composable
fun BudgetScreen(viewModel: BudgetViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    ModuleScaffold(title = "Budget", onBack = onBack) { padding ->
        when {
            state.loading -> LoadingBox(Modifier.padding(padding))

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                state.error?.let { message -> item { ErrorCard(message) } }

                item {
                    Card {
                        Column(Modifier.padding(16.dp)) {
                            Text(
                                "Across all accounts",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                formatZar(state.totalCents),
                                style = MaterialTheme.typography.headlineMedium,
                            )
                        }
                    }
                }

                items(state.accounts, key = { it.id }) { account ->
                    Card {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(account.name, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    formatZar(account.balanceCents),
                                    style = MaterialTheme.typography.titleLarge,
                                )
                            }
                            IconButton(onClick = { viewModel.deleteAccount(account.id) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Delete account")
                            }
                        }
                    }
                }

                if (state.accounts.isEmpty()) {
                    item {
                        EmptyState(
                            title = "No accounts yet",
                            description = "Add one to start tracking money.",
                        )
                    }
                }

                item {
                    // Equal weights and a single line each: at three buttons the
                    // longest label otherwise wraps mid-word on a phone.
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
                    item {
                        Text(
                            "Recent activity",
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                }

                items(state.transactions, key = { it.id }) { transaction ->
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        ),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(
                                    transaction.label,
                                    style = MaterialTheme.typography.titleSmall,
                                )
                                Text(
                                    transaction.flowLabel,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                transaction.description?.takeIf { it.isNotBlank() }?.let {
                                    Text(it, style = MaterialTheme.typography.bodySmall)
                                }
                            }
                            Text(
                                text = (if (transaction.isCredit) "+" else "−") +
                                    formatZar(transaction.amountCents),
                                style = MaterialTheme.typography.titleMedium,
                            )
                            IconButton(onClick = { viewModel.deleteTransaction(transaction.id) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Remove")
                            }
                        }
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
    }
}

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
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String, String, String) -> Unit,
) {
    var accountId by remember { mutableStateOf(accounts.firstOrNull()?.id.orEmpty()) }
    var type by remember { mutableStateOf("deposit") }
    var amount by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add transaction") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AccountPicker("Account", accounts, accountId) { accountId = it }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    listOf("deposit" to "Deposit", "withdrawal" to "Withdrawal")
                        .forEach { (value, label) ->
                            Row(
                                modifier = Modifier.selectable(
                                    selected = type == value,
                                    onClick = { type = value },
                                ),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(selected = type == value, onClick = { type = value })
                                Text(label)
                            }
                        }
                }

                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it.filter { c -> c.isDigit() || c == '.' } },
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
                onClick = { onSave(accountId, type, amount, description) },
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
                    onValueChange = { amount = it.filter { c -> c.isDigit() || c == '.' } },
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
