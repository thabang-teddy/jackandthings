package com.jackandthings

import android.app.Application
import com.jackandthings.pomodoro.PomodoroTimerEngine
import com.jackandthings.pomodoro.PomodoroTimerService
import com.jackandthings.update.AppUpdateChecker
import com.jackandthings.work.WorkoutReminders
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

class JackApplication : Application() {

    lateinit var container: AppContainer
        private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)

        WorkoutReminders.createChannel(this)

        // Re-arms on every launch so the schedule survives a reboot or an
        // install upgrade. KEEP means an already-queued run is left alone.
        if (container.prefs.remindersEnabled.value && container.auth.signedIn.value) {
            WorkoutReminders.schedule(this)
        }

        // PomodoroTimerEngine itself has no notion of Context or Services -
        // it only tracks whether a session is active - so this is what turns
        // "a timer started" into "the foreground notification is showing".
        PomodoroTimerEngine.state
            .map { it.activePreset != null }
            .distinctUntilChanged()
            .onEach { hasActiveSession -> if (hasActiveSession) PomodoroTimerService.start(this) }
            .launchIn(scope)

        // One check per process start rather than WorkManager: there is no
        // need for this to run while the app is closed, only to greet the
        // user with a banner if the build they are running has fallen behind
        // what the `apk` CI job has since published.
        scope.launch { AppUpdateChecker.check(BuildConfig.VERSION_NAME) }
    }
}
