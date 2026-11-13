package com.jackandthings.ui.pomodoro

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
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
import androidx.compose.ui.unit.dp
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.PomodoroPresetDraft

/**
 * Creating or editing a preset.
 *
 * The option lists below are the client's copy of the server enums
 * (App\Enums\PomodoroSound / PomodoroTicking / PomodoroAmbience). They are
 * spelled in wire values with a separate label, so the thing sent is never
 * the thing displayed - a label change cannot quietly break validation.
 */

private val ALARM_SOUNDS = listOf(
    "none" to "None",
    "chime" to "Chime",
    "bell" to "Bell",
    "digital" to "Digital",
    "marimba" to "Marimba",
)

private val TICK_SOUNDS = listOf(
    "none" to "None",
    "clock" to "Clock tick",
    "soft" to "Soft tick",
)

private val AMBIENCE = listOf(
    "none" to "None",
    "rain" to "Rain",
    "cafe" to "Cafe",
    "white_noise" to "White noise",
    "brown_noise" to "Brown noise",
    "lofi" to "Lo-fi loop",
)

@Composable
fun PresetDialog(
    existing: PomodoroPreset?,
    knownTags: List<String>,
    strictModeAvailable: Boolean,
    onGrantStrictMode: () -> Unit,
    onDismiss: () -> Unit,
    onConfirm: (PomodoroPresetDraft) -> Unit,
) {
    var name by remember { mutableStateOf(existing?.name.orEmpty()) }
    var focus by remember { mutableStateOf((existing?.focusMinutes ?: 25).toString()) }
    var shortBreak by remember { mutableStateOf((existing?.breakMinutes ?: 5).toString()) }
    var longBreak by remember { mutableStateOf((existing?.longBreakMinutes ?: 15).toString()) }
    var cycles by remember { mutableStateOf((existing?.cyclesBeforeLongBreak ?: 4).toString()) }
    var autoBreaks by remember { mutableStateOf(existing?.autoStartBreaks ?: true) }
    var autoFocus by remember { mutableStateOf(existing?.autoStartFocus ?: false) }
    var tag by remember { mutableStateOf(existing?.tag.orEmpty()) }
    var alarm by remember { mutableStateOf(existing?.alarmSound ?: "chime") }
    var ticking by remember { mutableStateOf(existing?.tickingSound ?: "none") }
    var ambience by remember { mutableStateOf(existing?.ambience ?: "none") }
    var strict by remember { mutableStateOf(existing?.strictMode ?: false) }
    var blocked by remember { mutableStateOf(existing?.blockedSites.orEmpty().joinToString("\n")) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existing == null) "New preset" else "Edit preset") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    singleLine = true,
                )

                SectionLabel("Timings")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MinutesField("Focus", focus, Modifier.weight(1f)) { focus = it }
                    MinutesField("Short break", shortBreak, Modifier.weight(1f)) { shortBreak = it }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MinutesField("Long break", longBreak, Modifier.weight(1f)) { longBreak = it }
                    MinutesField("Runs per long", cycles, Modifier.weight(1f)) { cycles = it }
                }

                SectionLabel("Auto-start")
                ToggleRow(
                    label = "Start breaks automatically",
                    checked = autoBreaks,
                    onCheckedChange = { autoBreaks = it },
                )
                ToggleRow(
                    label = "Start the next focus run automatically",
                    checked = autoFocus,
                    onCheckedChange = { autoFocus = it },
                )

                SectionLabel("Tag")
                OutlinedTextField(
                    value = tag,
                    onValueChange = { tag = it.take(40) },
                    label = { Text("Category") },
                    placeholder = { Text("Coding") },
                    singleLine = true,
                )
                if (knownTags.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        knownTags.take(4).forEach { known ->
                            AssistChip(onClick = { tag = known }, label = { Text(known) })
                        }
                    }
                }

                SectionLabel("Sound")
                SoundPicker("Alarm", ALARM_SOUNDS, alarm) { alarm = it }
                SoundPicker("Ticking", TICK_SOUNDS, ticking) { ticking = it }
                SoundPicker("Background", AMBIENCE, ambience) { ambience = it }

                SectionLabel("Strict mode")
                ToggleRow(
                    label = "Silence notifications while focusing",
                    checked = strict,
                    onCheckedChange = { strict = it },
                )
                if (strict && !strictModeAvailable) {
                    // Said plainly rather than left to be discovered: without
                    // the policy access this switch does nothing at all.
                    Text(
                        "Android has not granted this app permission to change " +
                            "Do Not Disturb, so nothing will be silenced yet.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                    TextButton(onClick = onGrantStrictMode) { Text("Open Settings") }
                }
                if (strict) {
                    OutlinedTextField(
                        value = blocked,
                        onValueChange = { blocked = it },
                        label = { Text("Sites to block (browser add-on only)") },
                        supportingText = { Text("One hostname per line.") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val focusMinutes = focus.toIntOrNull() ?: 0
                    if (name.isBlank() || focusMinutes <= 0) return@TextButton

                    onConfirm(
                        PomodoroPresetDraft(
                            name = name.trim(),
                            focusMinutes = focusMinutes,
                            breakMinutes = shortBreak.toIntOrNull() ?: 0,
                            longBreakMinutes = longBreak.toIntOrNull() ?: 0,
                            cyclesBeforeLongBreak = (cycles.toIntOrNull() ?: 4).coerceAtLeast(1),
                            autoStartBreaks = autoBreaks,
                            autoStartFocus = autoFocus,
                            tag = tag.trim().ifBlank { null },
                            alarmSound = alarm,
                            tickingSound = ticking,
                            ambience = ambience,
                            strictMode = strict,
                            blockedSites = blocked.split('\n', ',')
                                .map(String::trim)
                                .filter(String::isNotEmpty),
                            isDefault = existing?.isDefault ?: false,
                        ),
                    )
                },
            ) { Text(if (existing == null) "Add" else "Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun MinutesField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    onValueChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { onValueChange(it.filter(Char::isDigit).take(3)) },
        label = { Text(label) },
        singleLine = true,
        modifier = modifier,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
    )
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SoundPicker(
    label: String,
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == selected }?.second ?: selected

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.menuAnchor().fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (value, text) ->
                DropdownMenuItem(
                    text = { Text(text) },
                    onClick = {
                        onSelect(value)
                        expanded = false
                    },
                )
            }
        }
    }
}
