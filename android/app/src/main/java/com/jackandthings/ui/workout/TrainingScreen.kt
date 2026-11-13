package com.jackandthings.ui.workout

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.model.WorkoutSession
import com.jackandthings.model.WorkoutSet
import com.jackandthings.model.WorkoutSetDraft
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold
import com.jackandthings.ui.common.formatWhen
import com.jackandthings.workout.WorkoutFormat
import com.jackandthings.workout.WorkoutProgress

/**
 * The tracked workout: start one, log sets into it, rest, finish.
 *
 * The rest countdown is read from WorkoutRestTimer through the ViewModel
 * rather than owned here, so leaving the screen does not stop it.
 */
@Composable
fun TrainingScreen(
    viewModel: TrainingViewModel,
    onBack: () -> Unit,
    onOpenLibrary: () -> Unit,
    onOpenRoutines: () -> Unit,
    onOpenBody: () -> Unit,
    onOpenStats: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    ModuleScaffold(title = "Workout", onBack = onBack) { padding ->
        when {
            state.loading -> LoadingBox(Modifier.padding(padding))
            else -> LazyColumn(
                modifier = Modifier.padding(padding).fillMaxWidth(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                state.error?.let { message ->
                    item { ErrorCard(message) }
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = onOpenLibrary) { Text("Library") }
                        OutlinedButton(onClick = onOpenRoutines) { Text("Routines") }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = onOpenBody) { Text("Body") }
                        OutlinedButton(onClick = onOpenStats) { Text("Stats") }
                    }
                }

                val session = state.session

                if (session == null) {
                    item { StartWorkoutCard(state, viewModel) }
                } else {
                    item { LiveSessionCard(session, state, viewModel) }

                    if (state.rest.running) {
                        item { RestCard(state, viewModel) }
                    }

                    item { SetLoggerCard(state, viewModel) }

                    items(session.sets.reversed(), key = { it.id }) { set ->
                        LoggedSetRow(set) { viewModel.deleteSet(set.id) }
                    }
                }

                if (state.sessions.isNotEmpty()) {
                    item {
                        Text(
                            "Recent workouts",
                            style = MaterialTheme.typography.titleSmall,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }

                    items(state.sessions.filter { !it.isOpen }, key = { it.id }) { past ->
                        PastSessionRow(past) { viewModel.deleteSession(past.id) }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StartWorkoutCard(state: TrainingState, viewModel: TrainingViewModel) {
    var expanded by remember { mutableStateOf(false) }
    var routineId by remember { mutableStateOf<String?>(null) }

    val chosen = state.routines.firstOrNull { it.id == routineId }

    Card {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Start a tracked workout", style = MaterialTheme.typography.titleMedium)

            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                OutlinedTextField(
                    value = chosen?.name ?: "No routine - freestyle",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Routine") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                    modifier = Modifier
                        .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                        .fillMaxWidth(),
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    // Turning up and lifting without a plan is a real workout;
                    // refusing to track it would be a worse tracker.
                    DropdownMenuItem(
                        text = { Text("No routine - freestyle") },
                        onClick = {
                            routineId = null
                            expanded = false
                        },
                    )
                    state.routines.forEach { routine ->
                        DropdownMenuItem(
                            text = { Text(routine.name) },
                            onClick = {
                                routineId = routine.id
                                expanded = false
                            },
                        )
                    }
                }
            }

            Button(
                onClick = { viewModel.startWorkout(routineId) },
                enabled = !state.saving,
            ) {
                Text("Start")
            }
        }
    }
}

@Composable
private fun LiveSessionCard(
    session: WorkoutSession,
    state: TrainingState,
    viewModel: TrainingViewModel,
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    session.routineName ?: "Freestyle workout",
                    style = MaterialTheme.typography.titleMedium,
                )
                TextButton(
                    onClick = { viewModel.finishWorkout() },
                    enabled = !state.saving,
                ) {
                    Text("Finish")
                }
            }

            Text(
                listOfNotNull(
                    "${session.setCount} set${if (session.setCount == 1) "" else "s"}",
                    WorkoutFormat.volume(session.volumeGrams),
                    state.progress?.let { "routine $it" },
                ).joinToString(" · "),
                style = MaterialTheme.typography.bodyMedium,
            )

            state.nextSet?.let { next ->
                Text(
                    "Up next: ${next.item.exerciseName} - set ${next.setNumber} of ${next.targetSets}" +
                        (next.item.targetReps?.let { ", target $it reps" } ?: ""),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            if (state.recordJustSet) {
                Text(
                    "New personal record.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

@Composable
private fun RestCard(state: TrainingState, viewModel: TrainingViewModel) {
    Card {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Resting", style = MaterialTheme.typography.labelMedium)
            Text(
                state.rest.clock,
                style = MaterialTheme.typography.displaySmall,
                fontFamily = FontFamily.Monospace,
            )
            state.rest.label?.let { Text("Next: $it", style = MaterialTheme.typography.bodySmall) }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { viewModel.extendRest(30) }) { Text("+30s") }
                OutlinedButton(onClick = { viewModel.skipRest() }) { Text("Skip") }
            }
        }
    }
}

/**
 * Which inputs this draws comes from the exercise's metric through the shared
 * fieldsFor() rule, so a plank never asks for a weight and a bench press never
 * asks for a distance.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SetLoggerCard(state: TrainingState, viewModel: TrainingViewModel) {
    var expanded by remember { mutableStateOf(false) }
    var exerciseId by remember(state.nextSet?.exerciseId) {
        mutableStateOf(state.nextSet?.exerciseId ?: "")
    }
    var weight by remember { mutableStateOf("") }
    var reps by remember { mutableStateOf("") }
    var distance by remember { mutableStateOf("") }
    var duration by remember { mutableStateOf("") }
    var rpe by remember { mutableStateOf("") }
    var warmup by remember { mutableStateOf(false) }

    val exercise = state.exercises.firstOrNull { it.id == exerciseId }
    val fields = WorkoutProgress.fieldsFor(exercise?.metric)

    Card {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Log a set", style = MaterialTheme.typography.titleMedium)

            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                OutlinedTextField(
                    value = exercise?.name ?: "Pick an exercise",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Exercise") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                    modifier = Modifier
                        .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                        .fillMaxWidth(),
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    state.exercises.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.name) },
                            onClick = {
                                exerciseId = option.id
                                expanded = false
                            },
                        )
                    }
                }
            }

            if (fields.weight) {
                NumberField("Weight (kg)", weight) { weight = it }
            }
            if (fields.reps) {
                NumberField("Reps", reps) { reps = it }
            }
            if (fields.distance) {
                NumberField("Distance (m)", distance) { distance = it }
            }
            if (fields.duration) {
                NumberField("Time (seconds)", duration) { duration = it }
            }
            NumberField("RPE (optional)", rpe) { rpe = it }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = warmup, onCheckedChange = { warmup = it })
                Text("Warm-up (not counted towards records)")
            }

            Button(
                enabled = exerciseId.isNotEmpty() && !state.saving,
                onClick = {
                    viewModel.logSet(
                        WorkoutSetDraft(
                            exerciseId = exerciseId,
                            isWarmup = warmup,
                            reps = reps.trim().toIntOrNull(),
                            weightGrams = WorkoutFormat.kgToGrams(weight),
                            distanceMetres = distance.trim().toIntOrNull(),
                            durationSeconds = duration.trim().toIntOrNull(),
                            rpe = rpe.trim().toIntOrNull(),
                        ),
                    )
                    rpe = ""
                },
            ) {
                Text("Log set")
            }
        }
    }
}

@Composable
private fun NumberField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun LoggedSetRow(set: WorkoutSet, onDelete: () -> Unit) {
    Card {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(set.exerciseName ?: "Exercise", style = MaterialTheme.typography.bodyLarge)
                Text(
                    (if (set.isWarmup) "Warm-up · " else "") + WorkoutFormat.set(set),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            TextButton(onClick = onDelete) { Text("Remove") }
        }
    }
}

@Composable
private fun PastSessionRow(session: WorkoutSession, onDelete: () -> Unit) {
    Card {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    session.routineName ?: "Freestyle workout",
                    style = MaterialTheme.typography.bodyLarge,
                )
                Text(
                    listOfNotNull(
                        session.startedAt?.let { formatWhen(it) },
                        "${session.setCount} set${if (session.setCount == 1) "" else "s"}",
                        WorkoutFormat.volume(session.volumeGrams).takeIf { session.volumeGrams > 0 },
                    ).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            TextButton(onClick = onDelete) { Text("Delete") }
        }
    }
}

/** Shown when a workout has never been tracked, so the screen is not blank. */
@Composable
internal fun NoWorkoutsYet(modifier: Modifier = Modifier) {
    EmptyState(
        title = "No tracked workouts yet",
        description = "Start one above and every set you log lands here.",
        modifier = modifier,
    )
}
