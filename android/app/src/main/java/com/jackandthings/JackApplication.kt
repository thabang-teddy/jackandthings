package com.jackandthings

import android.app.Application
import com.jackandthings.pomodoro.PomodoroEvent
import com.jackandthings.pomodoro.PomodoroSounds
import com.jackandthings.pomodoro.PomodoroTimerEngine
import com.jackandthings.pomodoro.PomodoroTimerService
import com.jackandthings.update.AppUpdateChecker
import com.jackandthings.work.OutboxSync
import com.jackandthings.work.WorkoutReminders
import com.jackandthings.workout.RestTimerEvent
import com.jackandthings.workout.WorkoutRestService
import com.jackandthings.workout.WorkoutRestTimer
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

        // Writes made while the server was unreachable go up as soon as
        // there is a connection: once now, and on a slow loop after that in
        // case the app is never reopened.
        if (container.auth.signedIn.value) {
            OutboxSync.syncNow(this)
        }
        OutboxSync.schedule(this)

        // PomodoroTimerEngine itself has no notion of Context, Services, the
        // network or the audio device - it only tracks the countdown - so
        // this is where each of those is attached to it.

        // "A timer started" becomes "the foreground notification is showing".
        PomodoroTimerEngine.state
            .map { it.activePreset != null }
            .distinctUntilChanged()
            .onEach { hasActiveSession -> if (hasActiveSession) PomodoroTimerService.start(this) }
            .launchIn(scope)

        // The background bed follows the focus phase, and only it: ambience
        // playing through a break is the opposite of resting.
        PomodoroTimerEngine.state
            .map { timer ->
                if (timer.running && timer.phase.isFocus) {
                    timer.activePreset?.ambience ?: "none"
                } else {
                    "none"
                }
            }
            .distinctUntilChanged()
            .onEach { PomodoroSounds.startAmbience(it) }
            .launchIn(scope)

        // Strict mode's Do Not Disturb half. Engaging is conditional on the
        // notification-policy access the user grants in Settings; FocusGuard
        // reports whether it actually took effect, and the screen says so.
        PomodoroTimerEngine.state
            .map { it.strictEngaged }
            .distinctUntilChanged()
            .onEach { engaged ->
                if (engaged) container.focusGuard.engage() else container.focusGuard.release()
            }
            .launchIn(scope)

        PomodoroTimerEngine.events
            .onEach { event ->
                when (event) {
                    is PomodoroEvent.AlarmDue ->
                        PomodoroSounds.playAlarm(event.preset.alarmSound)

                    is PomodoroEvent.Ticked ->
                        PomodoroSounds.playTick(event.preset.tickingSound)

                    // Recorded here rather than in the ViewModel so an
                    // interval that ends with no Pomodoro screen open - the
                    // normal case, behind the foreground service - is still
                    // written.
                    is PomodoroEvent.IntervalEnded ->
                        container.pomodoroRecorder.record(event)
                }
            }
            .launchIn(scope)

        // WorkoutRestTimer is Context-free for the same reason the Pomodoro
        // engine is, so the service and the chime are attached to it here.

        // "A rest started" becomes "the foreground notification is showing",
        // which is what makes a rest survive the phone going in a pocket.
        WorkoutRestTimer.state
            .map { it.running }
            .distinctUntilChanged()
            .onEach { resting -> if (resting) WorkoutRestService.start(this) }
            .launchIn(scope)

        // Synthesised through the Pomodoro recipes - no audio file ships with
        // this project - and deliberately the alarm rather than a tick: the
        // end of a rest is the only moment worth interrupting.
        WorkoutRestTimer.events
            .onEach { event ->
                when (event) {
                    is RestTimerEvent.Finished -> PomodoroSounds.playAlarm("chime")
                }
            }
            .launchIn(scope)

        // One check per process start rather than WorkManager: there is no
        // need for this to run while the app is closed, only to greet the
        // user with a banner if the build they are running has fallen behind
        // what the `apk` CI job has since published.
        scope.launch { AppUpdateChecker.check(BuildConfig.VERSION_NAME) }
    }
}
