package com.jackandthings.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.AppContainer
import com.jackandthings.ui.common.ModuleScaffold

@Composable
fun SettingsScreen(
    container: AppContainer,
    onBack: () -> Unit,
    onRemindersChanged: (Boolean) -> Unit,
    onSignOut: () -> Unit,
) {
    val storedUrl by container.prefs.baseUrl.collectAsStateWithLifecycle()
    val remindersEnabled by container.prefs.remindersEnabled.collectAsStateWithLifecycle()
    val user by container.auth.user.collectAsStateWithLifecycle()

    var url by remember(storedUrl) { mutableStateOf(storedUrl) }

    ModuleScaffold(title = "Settings", onBack = onBack) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            user?.let {
                Text("Signed in as ${it.email}", style = MaterialTheme.typography.bodyMedium)
            }

            HorizontalDivider()

            Text("Server", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = url,
                onValueChange = { url = it },
                label = { Text("API base URL") },
                singleLine = true,
                supportingText = {
                    Text("Must end in /api/v1/. Use 10.0.2.2 for a dev server on the host machine.")
                },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedButton(
                onClick = { container.setBaseUrl(url) },
                enabled = url.isNotBlank() && url != storedUrl,
            ) { Text("Save server") }

            HorizontalDivider()

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Hourly workout reminder", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Checks once an hour and notifies only when nothing is logged.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(checked = remindersEnabled, onCheckedChange = onRemindersChanged)
            }

            HorizontalDivider()

            Button(onClick = onSignOut, modifier = Modifier.fillMaxWidth()) {
                Text("Sign out")
            }
        }
    }
}
