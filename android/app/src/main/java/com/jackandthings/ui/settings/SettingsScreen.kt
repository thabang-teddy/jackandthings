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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.AppContainer
import com.jackandthings.ui.common.ModuleScaffold
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    container: AppContainer,
    onBack: () -> Unit,
    onRemindersChanged: (Boolean) -> Unit,
    onSignOut: () -> Unit,
    onSignIn: () -> Unit,
) {
    val storedUrl by container.prefs.baseUrl.collectAsStateWithLifecycle()
    val remindersEnabled by container.prefs.remindersEnabled.collectAsStateWithLifecycle()
    val user by container.auth.user.collectAsStateWithLifecycle()
    val signedIn by container.auth.signedIn.collectAsStateWithLifecycle()

    var url by remember(storedUrl) { mutableStateOf(storedUrl) }

    ModuleScaffold(title = "Settings", onBack = onBack) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (signedIn) {
                user?.let {
                    Text("Signed in as ${it.email}", style = MaterialTheme.typography.bodyMedium)
                }
            } else {
                Text(
                    "Not signed in — your data is saved on this device only.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
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

            if (signedIn) {
                HorizontalDivider()
                PendingWrites(container)
            }

            HorizontalDivider()

            if (signedIn) {
                Button(onClick = onSignOut, modifier = Modifier.fillMaxWidth()) {
                    Text("Sign out")
                }
            } else {
                Button(onClick = onSignIn, modifier = Modifier.fillMaxWidth()) {
                    Text("Sign in")
                }
            }
        }
    }
}

/**
 * What is still waiting to reach the server, and a way to push it now.
 *
 * Without this the queue is invisible: a write made on a dead connection
 * looks identical to one that landed, and the user would have no way to know
 * anything was outstanding before, say, signing out or wiping the app.
 */
@Composable
private fun PendingWrites(container: AppContainer) {
    val scope = rememberCoroutineScope()
    var pending by remember { mutableStateOf<Int?>(null) }
    var syncing by remember { mutableStateOf(false) }
    var report by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { pending = container.outboxDrainer.pendingCount() }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Offline changes", style = MaterialTheme.typography.titleMedium)
        Text(
            when (pending) {
                null -> "Checking…"
                0 -> "Everything you have done is on the server."
                1 -> "1 change was made offline and is waiting to be sent."
                else -> "$pending changes were made offline and are waiting to be sent."
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        report?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if ((pending ?: 0) > 0) {
            OutlinedButton(
                enabled = !syncing,
                onClick = {
                    syncing = true
                    report = null
                    scope.launch {
                        val result = container.outboxDrainer.drain()
                        pending = result.stillPending
                        syncing = false
                        report = when {
                            result.stillPending > 0 && result.pushed == 0 ->
                                "Still cannot reach the server. Nothing was lost."
                            result.failed > 0 ->
                                "Sent ${result.pushed}. ${result.failed} were refused by the " +
                                    "server and have been dropped."
                            else -> "Sent ${result.pushed}."
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (syncing) "Sending…" else "Send now") }
        }
    }
}
