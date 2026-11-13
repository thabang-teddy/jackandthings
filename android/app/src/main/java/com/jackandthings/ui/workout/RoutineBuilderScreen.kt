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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.model.Exercise
import com.jackandthings.model.WorkoutRoutine
import com.jackandthings.model.WorkoutRoutineDraft
import com.jackandthings.model.WorkoutRoutineItemDraft
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold
import com.jackandthings.workout.WorkoutFormat
import com.jackandthings.workout.WorkoutProgress

/** One row being edited, before it becomes a WorkoutRoutineItemDraft. */
private data class ItemEntry(
    var exerciseId: String = "",
    var sets: String = "3",
    var reps: String = "",
    var weightKg: String = "",
    var distance: String = "",
    var duration: String = "",
    var rest: String = "90",
)

/**
 * The routine builder.
 *
 * `position` is never sent: the server assigns it from the order the items
 * arrive in, which is the order shown here, so reordering and inserting take
 * the same path as everything else.
 */
@Composable
fun RoutineBuilderScreen(viewModel: RoutineBuilderViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    ModuleScaffold(
        title = "Routines",
        onBack = onBack,
        floatingActionButton = {
            FloatingActionButton(onClick = viewModel::compose) {
                Icon(Icons.Default.Add, contentDescription = "Build a routine")
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

                if (state.routines.isEmpty()) {
                    item {
                        EmptyState(
                            title = "No routines yet",
                            description = "A routine is an ordered list of exercises with " +
                                "targets. It drives the targets and the rest timer during a workout.",
                        )
                    }
                }

                items(state.routines, key = { it.id }) { routine ->
                    RoutineCard(
                        routine = routine,
                        onEdit = { viewModel.edit(routine) },
                        onDelete = { viewModel.delete(routine) },
                    )
                }
            }
        }
    }

    if (state.composing) {
        RoutineDialog(
            editing = state.editing,
            exercises = state.exercises,
            saving = state.saving,
            onDismiss = viewModel::cancelCompose,
            onSave = viewModel::save,
        )
    }
}

@Composable
private fun RoutineCard(routine: WorkoutRoutine, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(routine.name, style = MaterialTheme.typography.bodyLarge)
                Row {
                    TextButton(onClick = onEdit) { Text("Edit") }
                    TextButton(onClick = onDelete) { Text("Delete") }
                }
            }

            routine.items.forEach { item ->
                Text(
                    listOfNotNull(
                        item.exerciseName,
                        item.targetSets?.let { sets ->
                            "$sets x ${item.targetReps ?: "-"}"
                        },
                        item.targetWeightGrams?.let { WorkoutFormat.kg(it) },
                    ).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RoutineDialog(
    editing: WorkoutRoutine?,
    exercises: List<Exercise>,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (WorkoutRoutineDraft) -> Unit,
) {
    var name by remember { mutableStateOf(editing?.name ?: "") }
    var notes by remember { mutableStateOf(editing?.notes ?: "") }

    val entries = remember {
        mutableStateListOf<ItemEntry>().apply {
            if (editing == null) {
                add(ItemEntry())
            } else {
                editing.items.forEach { item ->
                    add(
                        ItemEntry(
                            exerciseId = item.exerciseId,
                            sets = item.targetSets?.toString() ?: "3",
                            reps = item.targetReps?.toString() ?: "",
                            weightKg = item.targetWeightGrams?.let { (it / 1000.0).toString() } ?: "",
                            distance = item.targetDistanceMetres?.toString() ?: "",
                            duration = item.targetDurationSeconds?.toString() ?: "",
                            rest = item.restSeconds?.toString() ?: "90",
                        ),
                    )
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (editing == null) "Build a routine" else "Edit ${editing.name}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true)
                OutlinedTextField(notes, { notes = it }, label = { Text("Notes") })

                entries.forEachIndexed { index, entry ->
                    ItemEditor(entry, index, exercises) { updated -> entries[index] = updated }
                }

                OutlinedButton(onClick = { entries.add(ItemEntry()) }) {
                    Text("Add exercise")
                }
            }
        },
        confirmButton = {
            Button(
                enabled = name.isNotBlank() && entries.any { it.exerciseId.isNotEmpty() } && !saving,
                onClick = {
                    onSave(
                        WorkoutRoutineDraft(
                            name = name.trim(),
                            notes = notes.trim().ifBlank { null },
                            items = entries
                                .filter { it.exerciseId.isNotEmpty() }
                                .map { entry ->
                                    WorkoutRoutineItemDraft(
                                        exerciseId = entry.exerciseId,
                                        targetSets = entry.sets.trim().toIntOrNull(),
                                        targetReps = entry.reps.trim().toIntOrNull(),
                                        targetWeightGrams = WorkoutFormat.kgToGrams(entry.weightKg),
                                        targetDistanceMetres = entry.distance.trim().toIntOrNull(),
                                        targetDurationSeconds = entry.duration.trim().toIntOrNull(),
                                        restSeconds = entry.rest.trim().toIntOrNull(),
                                    )
                                },
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ItemEditor(
    entry: ItemEntry,
    index: Int,
    exercises: List<Exercise>,
    onChange: (ItemEntry) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }

    val exercise = exercises.firstOrNull { it.id == entry.exerciseId }
    // Before an exercise is chosen there is nothing to say which measures
    // apply, so only sets and rest are offered.
    val fields = exercise?.let { WorkoutProgress.fieldsFor(it.metric) }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
            OutlinedTextField(
                value = exercise?.name ?: "Pick an exercise",
                onValueChange = {},
                readOnly = true,
                label = { Text("Exercise ${index + 1}") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                modifier = Modifier
                        .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                        .fillMaxWidth(),
            )
            ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                exercises.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option.name) },
                        onClick = {
                            onChange(entry.copy(exerciseId = option.id))
                            expanded = false
                        },
                    )
                }
            }
        }

        OutlinedTextField(
            entry.sets,
            { onChange(entry.copy(sets = it)) },
            label = { Text("Sets") },
            singleLine = true,
        )

        if (fields?.reps == true) {
            OutlinedTextField(
                entry.reps,
                { onChange(entry.copy(reps = it)) },
                label = { Text("Reps") },
                singleLine = true,
            )
        }
        if (fields?.weight == true) {
            OutlinedTextField(
                entry.weightKg,
                { onChange(entry.copy(weightKg = it)) },
                label = { Text("Weight (kg)") },
                singleLine = true,
            )
        }
        if (fields?.distance == true) {
            OutlinedTextField(
                entry.distance,
                { onChange(entry.copy(distance = it)) },
                label = { Text("Distance (m)") },
                singleLine = true,
            )
        }
        if (fields?.duration == true) {
            OutlinedTextField(
                entry.duration,
                { onChange(entry.copy(duration = it)) },
                label = { Text("Time (seconds)") },
                singleLine = true,
            )
        }

        OutlinedTextField(
            entry.rest,
            { onChange(entry.copy(rest = it)) },
            label = { Text("Rest (seconds)") },
            singleLine = true,
        )
    }
}
