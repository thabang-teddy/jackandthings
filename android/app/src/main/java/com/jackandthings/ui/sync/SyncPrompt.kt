package com.jackandthings.ui.sync

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import com.jackandthings.repo.SyncResult

/** What the top-level sync prompt is doing right now. */
sealed interface SyncPromptState {
    data object Hidden : SyncPromptState
    data object Asking : SyncPromptState
    data object Syncing : SyncPromptState
    data class Done(val result: SyncResult) : SyncPromptState
}

/**
 * Offers to upload data saved on this device while signed out, shown after a
 * sign-in (fresh or restored) finds some waiting - see `JackApp.kt`.
 */
@Composable
fun SyncPromptHost(
    state: SyncPromptState,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    when (state) {
        SyncPromptState.Hidden -> Unit

        SyncPromptState.Asking -> AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Sync local data?") },
            text = {
                Text(
                    "You have notes, budget or other entries saved only on this " +
                        "device from using the app signed out. Upload them to your " +
                        "account now?",
                )
            },
            confirmButton = { TextButton(onClick = onConfirm) { Text("Sync") } },
            dismissButton = { TextButton(onClick = onDismiss) { Text("Not now") } },
        )

        SyncPromptState.Syncing -> AlertDialog(
            onDismissRequest = {},
            title = { Text("Syncing…") },
            text = { CircularProgressIndicator() },
            confirmButton = {},
        )

        is SyncPromptState.Done -> AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text(if (state.result.success) "Synced" else "Synced with errors") },
            text = {
                Text(
                    if (state.result.success) {
                        "${state.result.pushed} item(s) uploaded."
                    } else {
                        "${state.result.pushed} item(s) uploaded. " +
                            "${state.result.errors.size} failed and will be offered again later:\n" +
                            state.result.errors.joinToString("\n")
                    },
                )
            },
            confirmButton = { TextButton(onClick = onDismiss) { Text("OK") } },
        )
    }
}
