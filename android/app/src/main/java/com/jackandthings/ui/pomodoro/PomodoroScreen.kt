package com.jackandthings.ui.pomodoro

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold

@Composable
fun PomodoroScreen(viewModel: PomodoroViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showAdd by remember { mutableStateOf(false) }

    // A running timer takes the whole screen, which is what "full screen
    // countdown" in the brief asks for: no app bar, nothing else to look at.
    if (state.activePreset != null) {
        FullScreenTimer(
            clock = state.clock,
            phaseLabel = if (state.phase == TimerPhase.Focus) "Focus" else "Break",
            presetName = state.activePreset?.name.orEmpty(),
            running = state.running,
            onPause = viewModel::pause,
            onResume = viewModel::resume,
            onStop = viewModel::stop,
        )
        return
    }

    ModuleScaffold(
        title = "Pomodoro",
        onBack = onBack,
        floatingActionButton = {
            FloatingActionButton(onClick = { showAdd = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Add preset")
            }
        },
    ) { padding ->
        when {
            state.loading -> LoadingBox(Modifier.padding(padding))

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                state.error?.let { message ->
                    item { ErrorCard(message) }
                }

                if (state.presets.isEmpty()) {
                    item {
                        EmptyState(
                            title = "No presets yet",
                            description = "Add one to start a focus session.",
                        )
                    }
                }

                items(state.presets, key = { it.id }) { preset ->
                    Card {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(preset.name, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    "${preset.focusMinutes} min focus · ${preset.breakMinutes} min break",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Button(onClick = { viewModel.start(preset) }) { Text("Start") }
                            IconButton(onClick = { viewModel.deletePreset(preset.id) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Delete preset")
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAdd) {
        AddPresetDialog(
            onDismiss = { showAdd = false },
            onConfirm = { name, focus, breakMinutes ->
                viewModel.addPreset(name, focus, breakMinutes)
                showAdd = false
            },
        )
    }
}

@Composable
private fun FullScreenTimer(
    clock: String,
    phaseLabel: String,
    presetName: String,
    running: Boolean,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onStop: () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "$phaseLabel · $presetName",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = clock,
                fontSize = 84.sp,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(vertical = 24.dp),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (running) {
                    OutlinedButton(onClick = onPause) { Text("Pause") }
                } else {
                    Button(onClick = onResume) { Text("Resume") }
                }
                OutlinedButton(onClick = onStop) { Text("Stop") }
            }
        }
    }
}

@Composable
private fun AddPresetDialog(
    onDismiss: () -> Unit,
    onConfirm: (String, Int, Int) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var focus by remember { mutableStateOf("25") }
    var pause by remember { mutableStateOf("5") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New preset") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = focus,
                    onValueChange = { focus = it.filter(Char::isDigit) },
                    label = { Text("Focus minutes") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                OutlinedTextField(
                    value = pause,
                    onValueChange = { pause = it.filter(Char::isDigit) },
                    label = { Text("Break minutes") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val focusMinutes = focus.toIntOrNull() ?: 0
                    val breakMinutes = pause.toIntOrNull() ?: 0
                    if (name.isNotBlank() && focusMinutes > 0) {
                        onConfirm(name.trim(), focusMinutes, breakMinutes)
                    }
                },
            ) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
