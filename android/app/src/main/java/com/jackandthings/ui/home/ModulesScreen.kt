package com.jackandthings.ui.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jackandthings.ui.common.ModuleScaffold

/**
 * The five modules this app carries. History is deliberately absent: it is
 * browser history, so it belongs to the add-ons and the web app, which is how
 * docs/init.txt scopes the Android build too.
 */
private data class HomeModule(
    val route: String,
    val label: String,
    val description: String,
)

private val modules = listOf(
    HomeModule("pomodoro", "Pomodoro", "Full-screen countdown from a saved preset."),
    HomeModule("notes", "Notes", "Write and keep notes."),
    HomeModule("budget", "Budget", "Accounts, transactions and transfers in ZAR."),
    HomeModule("workout", "Workout", "Log workouts and get an hourly nudge."),
    HomeModule("watchlist", "Watch list", "Keep lists of things to watch or read."),
)

/**
 * The index of the modules. The welcome page is what the app opens on, so
 * this sits one step in from it and carries a way back.
 */
@Composable
fun ModulesScreen(
    onOpen: (String) -> Unit,
    onHome: () -> Unit,
    onSettings: () -> Unit,
) {
    ModuleScaffold(
        title = "Jack & Things",
        actions = {
            IconButton(onClick = onHome) {
                Icon(Icons.Filled.Home, contentDescription = "Home")
            }
            IconButton(onClick = onSettings) {
                Icon(Icons.Filled.Settings, contentDescription = "Settings")
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(modules, key = { it.route }) { module ->
                Card(modifier = Modifier.clickable { onOpen(module.route) }) {
                    Column(Modifier.fillMaxWidth().padding(16.dp)) {
                        Text(module.label, style = MaterialTheme.typography.titleMedium)
                        Text(
                            module.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
