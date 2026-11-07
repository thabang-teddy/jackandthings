package com.jackandthings.ui.clipboard

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
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold

@Composable
fun ClipboardScreen(viewModel: ClipboardViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current

    ModuleScaffold(
        title = "Clipboard",
        onBack = onBack,
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    // Pre-fills from the system clipboard, which is the usual
                    // reason to open this screen at all.
                    viewModel.startNew(clipboard.getText()?.text.orEmpty())
                },
            ) {
                Icon(Icons.Filled.Add, contentDescription = "New snippet")
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

                if (state.items.isEmpty()) {
                    item {
                        EmptyState(
                            title = "Nothing saved yet",
                            description = "Save text here to pick it up on another device.",
                        )
                    }
                }

                items(state.items, key = { it.id }) { item ->
                    Card {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                item.title?.takeIf { it.isNotBlank() }?.let {
                                    Text(it, style = MaterialTheme.typography.titleMedium)
                                }
                                Text(
                                    text = item.content,
                                    style = MaterialTheme.typography.bodyMedium,
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                item.sourceDevice?.let {
                                    Text(
                                        "from $it",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                            IconButton(
                                onClick = {
                                    clipboard.setText(AnnotatedString(item.content))
                                },
                            ) {
                                Icon(Icons.Filled.ContentCopy, contentDescription = "Copy")
                            }
                            IconButton(onClick = { viewModel.delete(item.id) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Delete snippet")
                            }
                        }
                    }
                }
            }
        }
    }

    state.draft?.let { prefill ->
        SnippetComposer(
            initialContent = prefill,
            saving = state.saving,
            onDismiss = viewModel::cancel,
            onSave = viewModel::save,
        )
    }
}

@Composable
private fun SnippetComposer(
    initialContent: String,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf(initialContent) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Save snippet") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it },
                    label = { Text("Content") },
                    minLines = 4,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(title, content) },
                enabled = content.isNotBlank() && !saving,
            ) { Text(if (saving) "Saving…" else "Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
