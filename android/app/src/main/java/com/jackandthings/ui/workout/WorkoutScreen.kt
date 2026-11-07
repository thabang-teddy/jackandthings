package com.jackandthings.ui.workout

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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold

@Composable
fun WorkoutScreen(viewModel: WorkoutViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    ModuleScaffold(
        title = "Workout",
        onBack = onBack,
        floatingActionButton = {
            FloatingActionButton(onClick = viewModel::startNew) {
                Icon(Icons.Filled.Add, contentDescription = "Log workout")
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

                if (state.dueForReminder) {
                    item {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                            ),
                        ) {
                            Column(Modifier.padding(16.dp)) {
                                Text(
                                    "Nothing logged this hour",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                                )
                                Text(
                                    state.lastLoggedAt?.let { "Last workout: $it" }
                                        ?: "No workouts logged yet.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                                )
                            }
                        }
                    }
                }

                if (state.entries.isEmpty()) {
                    item {
                        EmptyState(
                            title = "No workouts logged",
                            description = "Log what you do through the day.",
                        )
                    }
                }

                items(state.entries, key = { it.id }) { entry ->
                    Card {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(entry.activity, style = MaterialTheme.typography.titleMedium)
                                entry.notes?.takeIf { it.isNotBlank() }?.let {
                                    Text(it, style = MaterialTheme.typography.bodySmall)
                                }
                                entry.loggedAt?.let {
                                    Text(
                                        it,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                            IconButton(onClick = { viewModel.delete(entry.id) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Delete entry")
                            }
                        }
                    }
                }
            }
        }
    }

    if (state.composing) {
        LogWorkoutDialog(
            saving = state.saving,
            onDismiss = viewModel::cancel,
            onSave = viewModel::save,
        )
    }
}

@Composable
private fun LogWorkoutDialog(
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit,
) {
    var activity by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Log workout") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = activity,
                    onValueChange = { activity = it },
                    label = { Text("Activity") },
                    placeholder = { Text("5km run, push-ups…") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes (optional)") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(activity, notes) },
                enabled = activity.isNotBlank() && !saving,
            ) { Text(if (saving) "Saving…" else "Log it") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
