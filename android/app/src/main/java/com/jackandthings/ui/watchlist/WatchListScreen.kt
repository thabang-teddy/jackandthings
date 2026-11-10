package com.jackandthings.ui.watchlist

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.model.WatchList
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold

@Composable
fun WatchListScreen(viewModel: WatchListViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var composingList by remember { mutableStateOf(false) }

    ModuleScaffold(
        title = "Watch list",
        onBack = onBack,
        floatingActionButton = {
            FloatingActionButton(onClick = { composingList = true }) {
                Icon(Icons.Filled.Add, contentDescription = "New list")
            }
        },
    ) { padding ->
        when {
            state.loading -> LoadingBox(Modifier.padding(padding))

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                state.error?.let { message -> item { ErrorCard(message) } }

                if (state.lists.isEmpty()) {
                    item {
                        EmptyState(
                            title = "No lists yet",
                            description = "Create a list to start tracking things to watch or read.",
                        )
                    }
                }

                items(state.lists, key = { it.id }) { list ->
                    WatchListCard(
                        list = list,
                        onAddItem = { title -> viewModel.addItem(list.id, title) },
                        onToggleItem = viewModel::toggleItem,
                        onDeleteItem = viewModel::deleteItem,
                        onDeleteList = { viewModel.deleteList(list.id) },
                    )
                }
            }
        }
    }

    if (composingList) {
        NewListDialog(
            saving = state.saving,
            onDismiss = { composingList = false },
            onCreate = { name ->
                viewModel.createList(name)
                composingList = false
            },
        )
    }
}

@Composable
private fun WatchListCard(
    list: WatchList,
    onAddItem: (String) -> Unit,
    onToggleItem: (com.jackandthings.model.WatchListItem) -> Unit,
    onDeleteItem: (String) -> Unit,
    onDeleteList: () -> Unit,
) {
    var newItem by remember { mutableStateOf("") }

    Card {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    list.name,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onDeleteList) {
                    Icon(Icons.Filled.Delete, contentDescription = "Delete list")
                }
            }

            list.items.forEach { item ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        textDecoration = if (item.done) TextDecoration.LineThrough else null,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = { onToggleItem(item) }) {
                        Icon(
                            Icons.Filled.Check,
                            contentDescription = if (item.done) "Mark not done" else "Mark done",
                            tint = if (item.done) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                        )
                    }
                    IconButton(onClick = { onDeleteItem(item.id) }) {
                        Icon(Icons.Filled.Delete, contentDescription = "Delete item")
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = newItem,
                    onValueChange = { newItem = it },
                    label = { Text("Add item") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                IconButton(
                    onClick = {
                        onAddItem(newItem)
                        newItem = ""
                    },
                    enabled = newItem.isNotBlank(),
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Add item")
                }
            }
        }
    }
}

@Composable
private fun NewListDialog(
    saving: Boolean,
    onDismiss: () -> Unit,
    onCreate: (String) -> Unit,
) {
    var name by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New list") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("List name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        confirmButton = {
            TextButton(
                onClick = { onCreate(name) },
                enabled = name.isNotBlank() && !saving,
            ) { Text(if (saving) "Creating…" else "Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
