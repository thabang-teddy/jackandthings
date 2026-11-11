package com.jackandthings.ui

import android.Manifest
import android.content.Context
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.jackandthings.ui.home.ModulesScreen
import com.jackandthings.ui.notes.NotesScreen
import com.jackandthings.ui.notes.NotesViewModel
import com.jackandthings.ui.pomodoro.PomodoroScreen
import com.jackandthings.ui.pomodoro.PomodoroViewModel
import com.jackandthings.ui.settings.SettingsScreen
import com.jackandthings.ui.sync.SyncPromptHost
import com.jackandthings.ui.sync.SyncPromptState
import com.jackandthings.ui.theme.GlassBackground
import com.jackandthings.ui.watchlist.WatchListScreen
import com.jackandthings.ui.watchlist.WatchListViewModel
import com.jackandthings.ui.welcome.DashboardView
import com.jackandthings.ui.welcome.DashboardViewModel
import com.jackandthings.ui.welcome.WelcomeScreen
import com.jackandthings.ui.workout.WorkoutScreen
import com.jackandthings.ui.workout.WorkoutViewModel
import com.jackandthings.work.WorkoutReminders
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope

/**
 * Owns navigation across the module tree, which is shown whether or not
 * there is a signed-in session - see docs on [AppContainer] for how each
 * module falls back to on-device storage while signed out.
 *
 * [sharedText] carries text handed over by Android's share sheet, which jumps
 * to the Watch list rather than landing on the hub.
 */
@Composable
fun JackApp(container: AppContainer, sharedText: String?) {
    val signedIn by container.auth.signedIn.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var syncPrompt by remember { mutableStateOf<SyncPromptState>(SyncPromptState.Hidden) }

    // Offered once per sign-in - a fresh launch that restores a saved
    // session counts as one, and so does signing in again later in the same
    // session - whenever it finds a backlog left over from using the app
    // signed out.
    LaunchedEffect(signedIn) {
        val becameSignedIn = signedIn && container.lastSyncPromptSignedIn != true
        container.lastSyncPromptSignedIn = signedIn

        if (becameSignedIn && container.syncManager.hasPendingData()) {
            syncPrompt = SyncPromptState.Asking
        }
    }

    SyncPromptHost(
        state = syncPrompt,
        onConfirm = {
            syncPrompt = SyncPromptState.Syncing
            scope.launch { syncPrompt = SyncPromptState.Done(container.syncManager.sync()) }
        },
        onDismiss = { syncPrompt = SyncPromptState.Hidden },
    )

    MainApp(container = container, sharedText = sharedText, signedIn = signedIn)
}

@Composable
private fun MainApp(container: AppContainer, sharedText: String?, signedIn: Boolean) {
    val navController = rememberNavController()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    RequestNotificationPermissionOnce()

    // Shared text jumps to the Watch list rather than leaving the user to find
    // the screen themselves.
    LaunchedEffect(sharedText) {
        if (!sharedText.isNullOrBlank()) navController.navigate("watchlist")
    }

    NavHost(navController = navController, startDestination = "home") {
        // Home is the welcome page, as on the web: one page carrying two
        // views, the dashboard once there is an account behind it and the
        // clock before. The module index sits one step in, at "modules".
        composable("home") {
            GlassBackground {
                if (signedIn) {
                    val dashboard: DashboardViewModel = viewModel(
                        factory = DashboardViewModel.factory(
                            pomodoro = container.pomodoro,
                            workout = container.workout,
                        ),
                    )
                    val dashboardState by dashboard.state.collectAsStateWithLifecycle()

                    DashboardView(
                        state = dashboardState,
                        onLogWorkout = dashboard::logWorkout,
                        onStart = dashboard::start,
                        onPause = dashboard::pause,
                        onResume = dashboard::resume,
                        onStop = dashboard::stop,
                        onOpen = { route -> navController.navigate(route) },
                    )
                } else {
                    WelcomeScreen(
                        // The web page only offers the login affordance to a
                        // guest, and so does this one.
                        canSignIn = true,
                        onSignIn = { navController.navigate("login") },
                        onOpenHub = { navController.navigate("modules") },
                    )
                }
            }
        }

        composable("modules") {
            ModulesScreen(
                onOpen = { route -> navController.navigate(route) },
                onHome = { navController.popBackStack("home", inclusive = false) },
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

        composable("watchlist") {
            WatchListScreen(
                viewModel = viewModel(
                    factory = WatchListViewModel.factory(container.watchList),
                ),
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
                onSignIn = { navController.navigate("login") },
            )
        }

        composable("login") {
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

            // Nothing here drives the pop itself: a successful sign-in flips
            // the shared state, and this is the route's cue to step back out.
            LaunchedEffect(signedIn) {
                if (signedIn) navController.popBackStack()
            }
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
