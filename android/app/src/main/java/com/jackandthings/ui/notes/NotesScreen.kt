package com.jackandthings.ui.notes

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold

@Composable
fun NotesScreen(viewModel: NotesViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    ModuleScaffold(
        title = "Notes",
        onBack = onBack,
        floatingActionButton = {
            FloatingActionButton(onClick = viewModel::startNew) {
                Icon(Icons.Filled.Add, contentDescription = "New note")
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

                if (state.notes.isEmpty()) {
                    item {
                        EmptyState(
                            title = "No notes yet",
                            description = "Anything you write stays private to your account.",
                        )
                    }
                }

                items(state.notes, key = { it.id }) { note ->
                    Card(modifier = Modifier.clickable { viewModel.startEdit(note) }) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(note.title, style = MaterialTheme.typography.titleMedium)
                                note.body?.takeIf { it.isNotBlank() }?.let { body ->
                                    Text(
                                        text = body,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                            IconButton(onClick = { viewModel.toggleStar(note) }) {
                                Icon(
                                    imageVector = if (note.isStarred) {
                                        Icons.Filled.Star
                                    } else {
                                        Icons.Outlined.StarBorder
                                    },
                                    contentDescription = if (note.isStarred) {
                                        "Unstar note"
                                    } else {
                                        "Star note so it shows on the home screen"
                                    },
                                    tint = if (note.isStarred) {
                                        MaterialTheme.colorScheme.primary
                                    } else {
                                        MaterialTheme.colorScheme.onSurfaceVariant
                                    },
                                )
                            }
                            IconButton(onClick = { viewModel.delete(note.id) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Delete note")
                            }
                        }
                    }
                }
            }
        }
    }

    state.editing?.let { editing ->
        NoteEditor(
            initialTitle = editing.title,
            initialBody = editing.body.orEmpty(),
            saving = state.saving,
            onDismiss = viewModel::cancelEdit,
            onSave = viewModel::save,
        )
    }
}

@Composable
private fun NoteEditor(
    initialTitle: String,
    initialBody: String,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit,
) {
    var title by remember { mutableStateOf(initialTitle) }
    var body by remember { mutableStateOf(initialBody) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initialTitle.isBlank()) "New note" else "Edit note") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = body,
                    onValueChange = { body = it },
                    label = { Text("Body") },
                    minLines = 4,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(title, body) },
                enabled = title.isNotBlank() && !saving,
            ) { Text(if (saving) "Saving…" else "Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
