package com.jackandthings.ui.pomodoro

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Card
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedIconButton
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.pomodoro.FocusGuard
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold

@Composable
fun PomodoroScreen(viewModel: PomodoroViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var editing by remember { mutableStateOf<PomodoroPreset?>(null) }
    var showEditor by remember { mutableStateOf(false) }

    // A running timer takes the whole screen, which is what "full screen
    // countdown" in the brief asks for: no app bar, nothing else to look at.
    if (state.activePreset != null) {
        FullScreenTimer(state = state, viewModel = viewModel)
        return
    }

    ModuleScaffold(
        title = "Pomodoro",
        onBack = onBack,
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    editing = null
                    showEditor = true
                },
            ) {
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

                state.stats?.let { stats ->
                    item { FocusAnalyticsCard(stats) }
                }

                if (!state.historyAvailable) {
                    item {
                        Text(
                            "Sign in to keep a focus history and see your analytics.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
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
                    PresetRow(
                        preset = preset,
                        onStart = { viewModel.start(preset) },
                        onEdit = {
                            editing = preset
                            showEditor = true
                        },
                        onDelete = { viewModel.deletePreset(preset.id) },
                    )
                }
            }
        }
    }

    if (showEditor) {
        val target = editing
        PresetDialog(
            existing = target,
            knownTags = state.knownTags,
            strictModeAvailable = FocusGuard(context).canSilence(),
            onGrantStrictMode = { context.startActivity(FocusGuard(context).settingsIntent()) },
            onDismiss = { showEditor = false },
            onConfirm = { draft ->
                if (target == null) {
                    viewModel.addPreset(draft)
                } else {
                    viewModel.updatePreset(target.id, draft)
                }
                showEditor = false
            },
        )
    }
}

@Composable
private fun PresetRow(
    preset: PomodoroPreset,
    onStart: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    buildString {
                        append(preset.name)
                        preset.tag?.let { append("  ·  $it") }
                    },
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    buildString {
                        append("${preset.focusMinutes} min focus")
                        append(
                            if (preset.breakMinutes > 0) {
                                " · ${preset.breakMinutes} min break"
                            } else {
                                " · no break"
                            },
                        )
                        if (preset.longBreakMinutes > 0) {
                            append(
                                " · ${preset.longBreakMinutes} min long every " +
                                    "${preset.cyclesBeforeLongBreak}",
                            )
                        }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    buildString {
                        append(if (preset.autoStartBreaks) "auto breaks" else "manual breaks")
                        append(if (preset.autoStartFocus) " · auto focus" else " · manual focus")
                        if (preset.ambience != "none") append(" · ${preset.ambience}")
                        if (preset.strictMode) append(" · strict")
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            FilledIconButton(onClick = onStart) {
                Icon(Icons.Filled.PlayArrow, contentDescription = "Start ${preset.name}")
            }
            IconButton(onClick = onEdit) {
                Icon(Icons.Filled.Edit, contentDescription = "Edit preset")
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, contentDescription = "Delete preset")
            }
        }
    }
}

@Composable
private fun FullScreenTimer(state: PomodoroState, viewModel: PomodoroViewModel) {
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "${state.phase.label} · ${state.activePreset?.name.orEmpty()}",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = state.clock,
                fontSize = 84.sp,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(vertical = 24.dp),
            )

            if (state.cycleLength > 1) {
                CycleDots(position = state.cyclePosition, length = state.cycleLength)
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(top = 20.dp),
            ) {
                OutlinedIconButton(onClick = viewModel::restart) {
                    Icon(Icons.Filled.RestartAlt, contentDescription = "Restart")
                }
                if (state.running) {
                    FilledIconButton(onClick = viewModel::pause) {
                        Icon(Icons.Filled.Pause, contentDescription = "Pause")
                    }
                } else {
                    FilledIconButton(onClick = viewModel::resume) {
                        Icon(Icons.Filled.PlayArrow, contentDescription = "Resume")
                    }
                }
                OutlinedIconButton(onClick = viewModel::skip) {
                    Icon(Icons.Filled.SkipNext, contentDescription = "Skip")
                }
                OutlinedIconButton(onClick = viewModel::stop) {
                    Icon(Icons.Filled.Stop, contentDescription = "Stop")
                }
            }

            TextButton(onClick = { viewModel.setSoundEnabled(!state.soundEnabled) }) {
                Icon(
                    if (state.soundEnabled) Icons.Filled.VolumeUp else Icons.Filled.VolumeOff,
                    contentDescription = null,
                )
                Text(
                    if (state.soundEnabled) "  Sound on" else "  Sound off",
                    modifier = Modifier.padding(start = 4.dp),
                )
            }

            state.stats?.let { stats ->
                Text(
                    "${formatHoursMinutes(stats.today.focusSeconds)} focused today",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (state.strictEngaged) {
                Text(
                    "Strict mode: notifications are silenced until this run ends.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
            if (state.strictBlocked) {
                // The preset asked for strict mode and Android has not allowed
                // it. Better said than silently ignored.
                Text(
                    "Strict mode is on for this preset, but Do Not Disturb access " +
                        "has not been granted, so nothing is being silenced.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
        }
    }
}

/** "3 of 4" as dots, so the long break is never a surprise. */
@Composable
private fun CycleDots(position: Int, length: Int) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(length) { index ->
            val slot = index + 1
            val current = slot == position

            Box(
                modifier = Modifier
                    .height(6.dp)
                    .width(if (current) 20.dp else 6.dp)
                    .clip(CircleShape)
                    .background(
                        if (slot <= position) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.surfaceVariant
                        },
                    ),
            )
        }
        Text(
            "  $position/$length",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
