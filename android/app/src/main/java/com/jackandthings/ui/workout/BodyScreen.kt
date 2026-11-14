package com.jackandthings.ui.workout

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.model.BodyMetric
import com.jackandthings.model.BodyMetricDraft
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold
import com.jackandthings.workout.WorkoutFormat
import java.time.LocalDate

/** The tape sites the server records, matching App\Models\BodyMetric::SITES. */
private val SITES = listOf("chest", "waist", "hips", "arm", "thigh", "calf", "neck")

/** The four image types the server accepts; anything else is refused there. */
private val ACCEPTED_MIME = setOf("image/jpeg", "image/png", "image/webp", "image/heic")

/**
 * Body weight, body fat, tape measurements and progress photos.
 *
 * The picker is PickVisualMedia, which needs no storage permission at all -
 * the user hands over exactly one image and nothing else. There is no CAMERA
 * permission either: this picks, it does not capture.
 *
 * The picked image is read here and handed to the ViewModel as bytes, so the
 * ViewModel and its repository stay free of Context. It is never written to
 * the app's own storage: these are photographs of somebody's body, and a copy
 * left on the device is a copy that can leak.
 */
@Composable
fun BodyScreen(viewModel: BodyViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult

        val resolver = context.contentResolver
        val mime = resolver.getType(uri) ?: "image/jpeg"

        // Checked here as well as on the server so the user hears about an
        // unsupported image before a round trip, not after it.
        if (mime !in ACCEPTED_MIME) return@rememberLauncherForActivityResult

        val name = resolver.query(uri, null, null, null, null)?.use { cursor ->
            val column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (column >= 0 && cursor.moveToFirst()) cursor.getString(column) else null
        } ?: "photo"

        val bytes = runCatching {
            resolver.openInputStream(uri)?.use { it.readBytes() }
        }.getOrNull() ?: return@rememberLauncherForActivityResult

        viewModel.uploadPhoto(
            bytes = bytes,
            fileName = name,
            mimeType = mime,
            takenOn = LocalDate.now().toString(),
        )
    }

    ModuleScaffold(
        title = "Body",
        onBack = onBack,
        floatingActionButton = {
            FloatingActionButton(onClick = viewModel::compose) {
                Icon(Icons.Default.Add, contentDescription = "Log measurements")
            }
        },
    ) { padding ->
        when {
            state.loading -> LoadingBox(Modifier.padding(padding))
            else -> LazyColumn(
                modifier = Modifier.padding(padding).fillMaxWidth(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                state.error?.let { item { ErrorCard(it) } }

                item {
                    Card {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Latest", style = MaterialTheme.typography.titleSmall)
                            Text("Weight: ${WorkoutFormat.kg(state.latest?.weightGrams) ?: "-"}")
                            Text(
                                "Body fat: ${WorkoutFormat.bodyFat(state.latest?.bodyFatPermille) ?: "-"}",
                            )
                        }
                    }
                }

                item {
                    Card {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Progress photos", style = MaterialTheme.typography.titleSmall)
                            Text(
                                "${state.photos.size} saved. They are private to your account " +
                                    "and never given a public link.",
                                style = MaterialTheme.typography.bodySmall,
                            )
                            OutlinedButton(
                                enabled = !state.uploading,
                                onClick = {
                                    picker.launch(
                                        PickVisualMediaRequest(
                                            ActivityResultContracts.PickVisualMedia.ImageOnly,
                                        ),
                                    )
                                },
                            ) {
                                Text(if (state.uploading) "Uploading…" else "Add a photo")
                            }
                        }
                    }
                }

                if (state.metrics.isEmpty()) {
                    item {
                        EmptyState(
                            title = "Nothing logged yet",
                            description = "Weight, body fat and tape measurements go here.",
                        )
                    }
                }

                items(state.metrics, key = { it.id }) { metric ->
                    MetricRow(metric) { viewModel.deleteMetric(metric.id) }
                }
            }
        }
    }

    if (state.composing) {
        MeasurementDialog(
            saving = state.saving,
            onDismiss = viewModel::cancelCompose,
            onSave = viewModel::save,
        )
    }
}

@Composable
private fun MetricRow(metric: BodyMetric, onDelete: () -> Unit) {
    Card {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(metric.measuredOn, style = MaterialTheme.typography.bodyLarge)
                Text(
                    listOfNotNull(
                        WorkoutFormat.kg(metric.weightGrams),
                        WorkoutFormat.bodyFat(metric.bodyFatPermille),
                        *metric.measurements.map { (site, mm) ->
                            "${site.replaceFirstChar { it.uppercase() }} ${WorkoutFormat.tape(mm)}"
                        }.toTypedArray(),
                    ).joinToString(" · ").ifEmpty { "No figures" },
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            TextButton(onClick = onDelete) { Text("Delete") }
        }
    }
}

@Composable
private fun MeasurementDialog(
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (BodyMetricDraft) -> Unit,
) {
    var weight by remember { mutableStateOf("") }
    var bodyFat by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    val tape = remember { mutableStateOf(SITES.associateWith { "" }) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Log today's measurements") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(weight, { weight = it }, label = { Text("Weight (kg)") }, singleLine = true)
                OutlinedTextField(bodyFat, { bodyFat = it }, label = { Text("Body fat (%)") }, singleLine = true)

                SITES.forEach { site ->
                    OutlinedTextField(
                        value = tape.value[site].orEmpty(),
                        onValueChange = { tape.value = tape.value + (site to it) },
                        label = { Text("${site.replaceFirstChar { c -> c.uppercase() }} (cm)") },
                        singleLine = true,
                    )
                }

                OutlinedTextField(notes, { notes = it }, label = { Text("Notes") })
            }
        },
        confirmButton = {
            Button(
                enabled = !saving,
                onClick = {
                    onSave(
                        BodyMetricDraft(
                            measuredOn = LocalDate.now().toString(),
                            weightGrams = WorkoutFormat.kgToGrams(weight),
                            bodyFatPermille = WorkoutFormat.percentToPermille(bodyFat),
                            // Blank sites are dropped rather than sent as
                            // zero, so the record holds only what was measured.
                            measurements = tape.value.mapNotNull { (site, value) ->
                                WorkoutFormat.cmToMillimetres(value)?.let { site to it }
                            }.toMap(),
                            notes = notes.trim().ifBlank { null },
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
