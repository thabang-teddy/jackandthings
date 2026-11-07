package com.jackandthings.ui

import android.Manifest
import android.content.Context
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.jackandthings.AppContainer
import com.jackandthings.ui.auth.LoginScreen
import com.jackandthings.ui.auth.LoginViewModel
import com.jackandthings.ui.budget.BudgetScreen
import com.jackandthings.ui.budget.BudgetViewModel
import com.jackandthings.ui.clipboard.ClipboardScreen
import com.jackandthings.ui.clipboard.ClipboardViewModel
import com.jackandthings.ui.home.HomeScreen
import com.jackandthings.ui.notes.NotesScreen
import com.jackandthings.ui.notes.NotesViewModel
import com.jackandthings.ui.pomodoro.PomodoroScreen
import com.jackandthings.ui.pomodoro.PomodoroViewModel
import com.jackandthings.ui.settings.SettingsScreen
import com.jackandthings.ui.workout.WorkoutScreen
import com.jackandthings.ui.workout.WorkoutViewModel
import com.jackandthings.work.WorkoutReminders
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope

/**
 * Chooses between sign-in and the module tree, and owns navigation.
 *
 * [sharedText] carries text handed over by Android's share sheet, which opens
 * the Clipboard composer pre-filled instead of landing on the hub.
 */
@Composable
fun JackApp(container: AppContainer, sharedText: String?) {
    val signedIn by container.auth.signedIn.collectAsStateWithLifecycle()

    if (!signedIn) {
        val storedUrl by container.prefs.baseUrl.collectAsStateWithLifecycle()
        LoginScreen(
            viewModel = viewModel(
                factory = LoginViewModel.factory(
                    auth = container.auth,
                    applyServerUrl = container::setBaseUrl,
                    initialServerUrl = storedUrl,
                ),
            ),
        )
        return
    }

    SignedInApp(container = container, sharedText = sharedText)
}

@Composable
private fun SignedInApp(container: AppContainer, sharedText: String?) {
    val navController = rememberNavController()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    RequestNotificationPermissionOnce()

    // Shared text is only useful once: jump to Clipboard so the snippet can be
    // saved, rather than leaving the user to find the screen themselves.
    LaunchedEffect(sharedText) {
        if (!sharedText.isNullOrBlank()) navController.navigate("clipboard")
    }

    NavHost(navController = navController, startDestination = "home") {
        composable("home") {
            HomeScreen(
                onOpen = { route -> navController.navigate(route) },
                onSettings = { navController.navigate("settings") },
            )
        }

        composable("pomodoro") {
            PomodoroScreen(
                viewModel = viewModel(
                    factory = PomodoroViewModel.factory(container.pomodoro),
                ),
                onBack = navController::popBackStack,
            )
        }

        composable("notes") {
            NotesScreen(
                viewModel = viewModel(factory = NotesViewModel.factory(container.notes)),
                onBack = navController::popBackStack,
            )
        }

        composable("budget") {
            BudgetScreen(
                viewModel = viewModel(factory = BudgetViewModel.factory(container.budget)),
                onBack = navController::popBackStack,
            )
        }

        composable("workout") {
            WorkoutScreen(
                viewModel = viewModel(factory = WorkoutViewModel.factory(container.workout)),
                onBack = navController::popBackStack,
            )
        }

        composable("clipboard") {
            val clipboardViewModel: ClipboardViewModel =
                viewModel(factory = ClipboardViewModel.factory(container.clipboard))

            LaunchedEffect(sharedText) {
                if (!sharedText.isNullOrBlank()) clipboardViewModel.startNew(sharedText)
            }

            ClipboardScreen(
                viewModel = clipboardViewModel,
                onBack = navController::popBackStack,
            )
        }

        composable("settings") {
            SettingsScreen(
                container = container,
                onBack = navController::popBackStack,
                onRemindersChanged = { enabled ->
                    container.prefs.setRemindersEnabled(enabled)
                    if (enabled) {
                        WorkoutReminders.schedule(context)
                    } else {
                        WorkoutReminders.cancel(context)
                    }
                },
                onSignOut = {
                    scope.launch {
                        // Cancelled first: a signed-out device has no token to
                        // check the due endpoint with.
                        WorkoutReminders.cancel(context)
                        container.auth.signOut()
                    }
                },
            )
        }
    }
}

/**
 * On API 33+ a notification needs the user's consent, and the workout reminder
 * is the only one this app posts. Asked once on first signed-in launch; a
 * refusal is respected and the worker checks before posting anyway.
 */
@Composable
private fun RequestNotificationPermissionOnce() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return

    val context: Context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = { },
    )

    val alreadyGranted = remember {
        androidx.core.content.ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    LaunchedEffect(alreadyGranted) {
        if (!alreadyGranted) launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}
