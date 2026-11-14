package com.jackandthings.ui.workout

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
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
import com.jackandthings.model.Exercise
import com.jackandthings.model.ExerciseDraft
import com.jackandthings.model.ExerciseHistory
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold
import com.jackandthings.workout.WorkoutFormat

/**
 * The exercise library: the seeded catalog plus the user's own.
 *
 * Expanding an exercise shows its written instructions and cues - there is no
 * image or video, for the same reason the Pomodoro sounds are synthesised
 * rather than sampled - and what the user last did with it, which is the
 * progressive-overload half of the issue.
 */
@Composable
fun ExerciseLibraryScreen(viewModel: ExerciseLibraryViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    ModuleScaffold(
        title = "Exercises",
        onBack = onBack,
        floatingActionButton = {
            FloatingActionButton(onClick = viewModel::compose) {
                Icon(Icons.Default.Add, contentDescription = "Add an exercise")
            }
        },
    ) { padding ->
        when {
            state.loading -> LoadingBox(Modifier.padding(padding))
            else -> LazyColumn(
                modifier = Modifier.padding(padding).fillMaxWidth(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                state.error?.let { item { ErrorCard(it) } }

                item {
                    OutlinedTextField(
                        value = state.search,
                        onValueChange = viewModel::search,
                        label = { Text("Search name, muscle or kit") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        AssistChip(
                            onClick = { viewModel.filterBy(null) },
                            label = { Text("All") },
                        )
                        state.categories.forEach { category ->
                            AssistChip(
                                onClick = { viewModel.filterBy(category) },
                                label = { Text(category.replaceFirstChar { it.uppercase() }) },
                            )
                        }
                    }
                }

                if (state.visible.isEmpty()) {
                    item {
                        EmptyState(
                            title = "Nothing matches that",
                            description = "Clear the filters, or add it as your own exercise.",
                        )
                    }
                }

                items(state.visible, key = { it.id }) { exercise ->
                    ExerciseCard(
                        exercise = exercise,
                        expanded = state.expandedId == exercise.id,
                        history = state.history.takeIf { state.expandedId == exercise.id },
                        onToggle = { viewModel.toggle(exercise) },
                        onEdit = { viewModel.edit(exercise) },
                        onDelete = { viewModel.delete(exercise) },
                    )
                }
            }
        }
    }

    if (state.composing) {
        ExerciseDialog(
            editing = state.editing,
            saving = state.saving,
            onDismiss = viewModel::cancelCompose,
            onSave = viewModel::save,
        )
    }
}

@Composable
private fun ExerciseCard(
    exercise: Exercise,
    expanded: Boolean,
    history: ExerciseHistory?,
    onToggle: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Card {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        exercise.name + if (exercise.isCustom) " (yours)" else "",
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Text(
                        listOfNotNull(
                            exercise.categoryLabel.takeIf { it.isNotEmpty() },
                            exercise.primaryMuscle,
                            exercise.equipment,
                        ).joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                TextButton(onClick = onToggle) { Text(if (expanded) "Hide" else "Show") }
            }

            if (expanded) {
                Text("Tracks: ${exercise.metricLabel}", style = MaterialTheme.typography.bodySmall)

                exercise.instructions?.let {
                    Text(it, style = MaterialTheme.typography.bodyMedium)
                }

                exercise.cues.forEach { cue ->
                    Text("• $cue", style = MaterialTheme.typography.bodySmall)
                }

                // "No history yet" rather than zeroes: the two mean different
                // things, and showing 0 kg would read as a bad session.
                if (history == null) {
                    Text("No history yet.", style = MaterialTheme.typography.bodySmall)
                } else {
                    history.best.bestOneRepMaxGrams?.let {
                        Text(
                            "Best estimated 1RM: ${WorkoutFormat.kg(it)}",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    history.sessions.firstOrNull()?.let { last ->
                        Text(
                            "Last time: " + last.sets.joinToString(", ") { set ->
                                listOfNotNull(
                                    WorkoutFormat.kg(set.weightGrams),
                                    set.reps?.let { "x $it" },
                                ).joinToString(" ")
                            },
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }

                if (exercise.isCustom) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = onEdit) { Text("Edit") }
                        TextButton(onClick = onDelete) { Text("Delete") }
                    }
                }
            }
        }
    }
}

@Composable
private fun ExerciseDialog(
    editing: Exercise?,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (ExerciseDraft) -> Unit,
) {
    var name by remember { mutableStateOf(editing?.name ?: "") }
    var category by remember { mutableStateOf(editing?.category ?: "strength") }
    var metric by remember { mutableStateOf(editing?.metric ?: "weight_reps") }
    var muscle by remember { mutableStateOf(editing?.primaryMuscle ?: "") }
    var equipment by remember { mutableStateOf(editing?.equipment ?: "") }
    var instructions by remember { mutableStateOf(editing?.instructions ?: "") }
    var cues by remember { mutableStateOf(editing?.cues?.joinToString("\n") ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (editing == null) "Add an exercise" else "Edit ${editing.name}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true)
                OutlinedTextField(
                    category,
                    { category = it },
                    label = { Text("Category (strength/cardio/flexibility/mobility)") },
                    singleLine = true,
                )
                OutlinedTextField(
                    metric,
                    { metric = it },
                    label = { Text("Tracks (weight_reps/reps_only/distance_duration/duration)") },
                    singleLine = true,
                )
                OutlinedTextField(muscle, { muscle = it }, label = { Text("Main muscle") }, singleLine = true)
                OutlinedTextField(equipment, { equipment = it }, label = { Text("Equipment") }, singleLine = true)
                OutlinedTextField(instructions, { instructions = it }, label = { Text("How to do it") })
                OutlinedTextField(cues, { cues = it }, label = { Text("Cues, one per line") })
            }
        },
        confirmButton = {
            Button(
                enabled = name.isNotBlank() && !saving,
                onClick = {
                    onSave(
                        ExerciseDraft(
                            name = name.trim(),
                            category = category.trim(),
                            metric = metric.trim(),
                            primaryMuscle = muscle.trim().ifBlank { null },
                            equipment = equipment.trim().ifBlank { null },
                            instructions = instructions.trim().ifBlank { null },
                            // Blank lines dropped: an empty cue renders as an
                            // empty bullet, which reads as a bug.
                            cues = cues.lines().map { it.trim() }.filter { it.isNotEmpty() },
                        ),
                    )
                },
            ) {
                Text("Save")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
