package com.jackandthings.ui.settings

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.AppContainer
import com.jackandthings.BuildConfig
import com.jackandthings.data.ThemeMode
import com.jackandthings.ui.common.ModuleScaffold
import com.jackandthings.update.AppUpdateChecker
import com.jackandthings.update.UpdateCheck
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
    val themeMode by container.prefs.themeMode.collectAsStateWithLifecycle()
    val user by container.auth.user.collectAsStateWithLifecycle()
    val signedIn by container.auth.signedIn.collectAsStateWithLifecycle()

    var url by remember(storedUrl) { mutableStateOf(storedUrl) }

    ModuleScaffold(title = "Settings", onBack = onBack) { padding ->
        Column(
            // Scrollable because the sections below no longer fit on a short
            // handset once Appearance and Updates are counted; without this
            // the sign-out button (and the update check) could sit off-screen
            // with no way to reach them.
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
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

            Appearance(themeMode = themeMode, onSelect = container.prefs::setThemeMode)

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

            Updates()

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
 * System follows the phone; Light and Dark override it. The choice reaches
 * every surface because [com.jackandthings.ui.theme.JackTheme] resolves it
 * once, including the glass palette and the system bars - see
 * [com.jackandthings.ui.theme.MatchSystemBars].
 */
@Composable
private fun Appearance(themeMode: ThemeMode, onSelect: (ThemeMode) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Appearance", style = MaterialTheme.typography.titleMedium)
        Text(
            "System follows your phone's light or dark setting.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            ThemeMode.entries.forEach { mode ->
                FilterChip(
                    selected = themeMode == mode,
                    onClick = { onSelect(mode) },
                    label = { Text(mode.label()) },
                )
            }
        }
    }
}

private fun ThemeMode.label(): String = when (this) {
    ThemeMode.SYSTEM -> "System"
    ThemeMode.LIGHT -> "Light"
    ThemeMode.DARK -> "Dark"
}

/**
 * The build being run, and a way to ask GitHub whether it is still the newest
 * one. The launch check only ever produces a banner for a newer build, which
 * leaves "I am current" and "the check never reached GitHub" looking the same
 * - so this says which it is instead of staying silent.
 */
@Composable
private fun Updates() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var checking by remember { mutableStateOf(false) }
    var outcome by remember { mutableStateOf<UpdateCheck?>(null) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Updates", style = MaterialTheme.typography.titleMedium)
        Text(
            "Version ${BuildConfig.VERSION_NAME}. Checks GitHub for a newer release.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        when (val result = outcome) {
            null -> Unit
            is UpdateCheck.Available -> {
                Text(
                    "Version ${result.version.versionName} is available.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedButton(
                    onClick = {
                        context.startActivity(
                            Intent(Intent.ACTION_VIEW, Uri.parse(result.version.downloadUrl)),
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Open the release page") }
            }

            UpdateCheck.UpToDate -> Text(
                "You are on the latest version.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            UpdateCheck.Unreachable -> Text(
                // Offline and rate-limited look the same from here, so the
                // wording must not insist on either one.
                "Could not check for updates right now. Try again later.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        OutlinedButton(
            enabled = !checking,
            onClick = {
                checking = true
                outcome = null
                scope.launch {
                    outcome = AppUpdateChecker.checkNow(BuildConfig.VERSION_NAME)
                    checking = false
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (checking) "Checking…" else "Check for updates") }
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
