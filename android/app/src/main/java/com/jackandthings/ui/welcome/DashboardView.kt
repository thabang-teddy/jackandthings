package com.jackandthings.ui.welcome

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.pomodoro.TimerPhase
import com.jackandthings.ui.common.formatWhen
import com.jackandthings.ui.theme.GlassCircleButton
import com.jackandthings.ui.theme.PillButton
import com.jackandthings.ui.theme.glassFieldColors
import com.jackandthings.ui.theme.glassTokens

/**
 * The welcome page as a signed-in user sees it, ported from
 * `laravel/resources/js/Pages/Welcome/AuthenticatedView.jsx`: a clock that
 * flips to a Pomodoro countdown, the workout reminder line, and a rail of
 * quick links.
 *
 * The web page also carries a quick-notes card beside the clock; this one
 * deliberately does not, and the Notes module is reached from the rail's
 * module index instead.
 */
@Composable
fun DashboardView(
    state: DashboardState,
    onLogWorkout: (activity: String, notes: String, onLogged: () -> Unit) -> Unit,
    onStart: (PomodoroPreset) -> Unit,
    onRestart: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onSkip: () -> Unit,
    onStop: () -> Unit,
    onOpen: (route: String) -> Unit,
) {
    val tokens = glassTokens()

    var pomodoroMode by rememberSaveable { mutableStateOf(false) }
    var workoutOpen by rememberSaveable { mutableStateOf(false) }
    var activity by rememberSaveable { mutableStateOf("") }
    var workoutNotes by rememberSaveable { mutableStateOf("") }

    fun closeWorkout() {
        workoutOpen = false
        activity = ""
        workoutNotes = ""
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = "JACK & THINGS",
                color = tokens.muted,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 3.6.sp,
            )

            if (pomodoroMode) {
                PomodoroReadout(
                    state = state,
                    onStart = onStart,
                    onRestart = onRestart,
                    onPause = onPause,
                    onResume = onResume,
                    onSkip = onSkip,
                    onStop = onStop,
                    onOpenPomodoro = { onOpen("pomodoro") },
                )
            } else {
                Text(
                    text = rememberClockText(),
                    color = tokens.ink,
                    fontSize = 56.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    softWrap = false,
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(tokens.cardBg, CircleShape)
                    .border(1.dp, tokens.cardBorder, CircleShape)
                    .padding(horizontal = 20.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val reminder = state.reminder
                Text(
                    text = when {
                        // Says nothing about workouts until it has actually
                        // been told, rather than guessing at a default.
                        reminder == null -> "Checking…"
                        reminder.due -> "Nothing logged this hour"
                        else ->
                            "Last workout: " +
                                (reminder.lastLoggedAt?.let(::formatWhen) ?: "none yet")
                    },
                    color = tokens.muted,
                    fontSize = 13.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "Add Workout",
                    color = tokens.accent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickable { workoutOpen = true },
                )
            }

            state.error?.let { message ->
                Text(
                    text = message,
                    color = tokens.muted,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            GlassCircleButton(
                icon = if (pomodoroMode) Icons.Outlined.Schedule else Icons.Outlined.Timer,
                contentDescription = if (pomodoroMode) "Show clock" else "Show Pomodoro timer",
                onClick = { pomodoroMode = !pomodoroMode },
                active = pomodoroMode,
            )
            GlassCircleButton(
                icon = Icons.Outlined.BarChart,
                contentDescription = "Budget",
                onClick = { onOpen("budget") },
            )
            GlassCircleButton(
                icon = Icons.Outlined.GridView,
                contentDescription = "All modules",
                onClick = { onOpen("modules") },
            )
        }
    }

    if (workoutOpen) {
        AlertDialog(
            onDismissRequest = ::closeWorkout,
            containerColor = tokens.bg,
            titleContentColor = tokens.ink,
            textContentColor = tokens.ink,
            title = { Text("Log workout") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (state.workoutPresets.isNotEmpty()) {
                        var expanded by remember { mutableStateOf(false) }

                        Box {
                            PillButton(
                                text = "Pick a preset…",
                                onClick = { expanded = true },
                            )
                            DropdownMenu(
                                expanded = expanded,
                                onDismissRequest = { expanded = false },
                            ) {
                                state.workoutPresets.forEach { preset ->
                                    DropdownMenuItem(
                                        text = { Text(preset.name) },
                                        onClick = {
                                            activity = preset.activity
                                            expanded = false
                                        },
                                    )
                                }
                            }
                        }
                    }

                    OutlinedTextField(
                        value = activity,
                        onValueChange = { activity = it },
                        label = { Text("Activity") },
                        placeholder = { Text("Push-ups, 5km run, gym session…") },
                        singleLine = true,
                        colors = glassFieldColors(),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = workoutNotes,
                        onValueChange = { workoutNotes = it },
                        label = { Text("Notes (optional)") },
                        placeholder = { Text("Felt strong, 3 sets of 12") },
                        minLines = 2,
                        colors = glassFieldColors(),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                PillButton(
                    text = "Log it",
                    primary = true,
                    enabled = activity.isNotBlank() && !state.saving,
                    onClick = { onLogWorkout(activity, workoutNotes) { closeWorkout() } },
                )
            },
            dismissButton = { PillButton("Cancel", onClick = ::closeWorkout) },
        )
    }
}

/**
 * The countdown half of the centre column. With no default preset there is
 * nothing to start from, so it points at the Pomodoro module instead - the
 * same dead end the web page offers.
 */
@Composable
private fun PomodoroReadout(
    state: DashboardState,
    onStart: (PomodoroPreset) -> Unit,
    onRestart: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onSkip: () -> Unit,
    onStop: () -> Unit,
    onOpenPomodoro: () -> Unit,
) {
    val tokens = glassTokens()
    val preset = state.defaultPreset

    if (preset == null) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "--:--",
                color = tokens.ink,
                fontSize = 56.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Set a default preset to start from here",
                color = tokens.accent,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.clickable { onOpenPomodoro() },
            )
        }
        return
    }

    val seconds = if (state.idle) preset.focusMinutes * 60 else state.secondsLeft
    val caption = if (state.idle) {
        preset.name
    } else {
        val phase = if (state.phase == TimerPhase.Focus) "Focus" else "Break"
        "$phase · ${state.activePreset?.name.orEmpty()}"
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            text = caption.uppercase(),
            color = tokens.muted,
            fontSize = 12.sp,
            letterSpacing = 2.sp,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "%02d:%02d".format(seconds / 60, seconds % 60),
            color = tokens.ink,
            fontSize = 56.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (state.idle) {
                GlassCircleButton(
                    icon = Icons.Filled.PlayArrow,
                    contentDescription = "Start",
                    active = true,
                    onClick = { onStart(preset) },
                )
            } else {
                GlassCircleButton(
                    icon = Icons.Filled.RestartAlt,
                    contentDescription = "Restart",
                    onClick = onRestart,
                )
                if (state.running) {
                    GlassCircleButton(
                        icon = Icons.Filled.Pause,
                        contentDescription = "Pause",
                        active = true,
                        onClick = onPause,
                    )
                } else {
                    GlassCircleButton(
                        icon = Icons.Filled.PlayArrow,
                        contentDescription = "Resume",
                        active = true,
                        onClick = onResume,
                    )
                }
                GlassCircleButton(
                    icon = Icons.Filled.SkipNext,
                    contentDescription = "Skip",
                    onClick = onSkip,
                )
                GlassCircleButton(
                    icon = Icons.Filled.Stop,
                    contentDescription = "Stop",
                    onClick = onStop,
                )
            }
        }
    }
}
