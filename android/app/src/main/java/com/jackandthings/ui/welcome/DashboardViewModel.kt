package com.jackandthings.ui.welcome

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.ReminderState
import com.jackandthings.model.WorkoutPreset
import com.jackandthings.pomodoro.PomodoroTimerEngine
import com.jackandthings.pomodoro.PomodoroTimerState
import com.jackandthings.pomodoro.TimerPhase
import com.jackandthings.repo.PomodoroRepository
import com.jackandthings.repo.WorkoutRepository
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Which readout the centre of the page is showing. */
enum class DashboardMode { Clock, Pomodoro }

data class DashboardState(
    val workoutPresets: List<WorkoutPreset> = emptyList(),
    val defaultPreset: PomodoroPreset? = null,
    /**
     * Null until the first read lands. Kept whole rather than flattened so
     * "not asked yet" stays distinct from "nothing logged yet" - flattening
     * them made the line claim there was no workout before it had looked.
     */
    val reminder: ReminderState? = null,
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: String? = null,
    val activePreset: PomodoroPreset? = null,
    val phase: TimerPhase = TimerPhase.Focus,
    val secondsLeft: Int = 0,
    val running: Boolean = false,
) {
    /** Nothing has been started yet, so the page offers the default preset. */
    val idle: Boolean get() = activePreset == null

    val clock: String get() = "%02d:%02d".format(secondsLeft / 60, secondsLeft % 60)
}

/**
 * Backs the welcome page's signed-in view: the workout reminder line, the
 * presets its popup offers, and the countdown.
 *
 * The countdown mirrors `Lib/useCountdown.js` and is backed by the same
 * [PomodoroTimerEngine] the Pomodoro screen uses, rather than a ticker of its
 * own - that is what lets a timer started here still be running after a trip
 * to the Pomodoro screen and back, the same way the web's shared
 * `PomodoroTimerContext` does. Like the web, it is never persisted across a
 * process restart: the server has no session table.
 */
class DashboardViewModel(
    private val pomodoro: PomodoroRepository,
    private val workout: WorkoutRepository,
    private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(DashboardState())
    val state: StateFlow<DashboardState> = _state.asStateFlow()

    init {
        refresh()
        viewModelScope.launch {
            PomodoroTimerEngine.state.collect { timer -> applyTimer(timer) }
        }
    }

    private fun applyTimer(timer: PomodoroTimerState) {
        _state.update {
            it.copy(
                activePreset = timer.activePreset,
                phase = timer.phase,
                secondsLeft = timer.secondsLeft,
                running = timer.running,
            )
        }
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }

        viewModelScope.launch {
            val presetList = pomodoro.list()
            val reminderState = workout.reminderState()
            val workoutPresets = workout.presets()

            val failure = presetList.exceptionOrNull() ?: reminderState.exceptionOrNull()

            _state.update { current ->
                current.copy(
                    defaultPreset = presetList.getOrNull()?.firstOrNull { it.isDefault }
                        ?: current.defaultPreset,
                    reminder = reminderState.getOrNull() ?: current.reminder,
                    // A missing preset list is not worth an error line: the
                    // popup just offers no shortcuts.
                    workoutPresets = workoutPresets.getOrElse { current.workoutPresets },
                    loading = false,
                    error = failure?.readableMessage(),
                )
            }
        }
    }

    fun dismissError() = _state.update { it.copy(error = null) }

    // ── Workout ────────────────────────────────────────────────────────────

    fun logWorkout(activity: String, notes: String, onLogged: () -> Unit) {
        if (activity.isBlank()) return

        _state.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            workout.create(activity.trim(), notes.trim().takeIf { it.isNotBlank() }).fold(
                onSuccess = {
                    _state.update { it.copy(saving = false) }
                    onLogged()
                    refresh()
                },
                onFailure = { failure ->
                    _state.update { it.copy(saving = false, error = failure.readableMessage()) }
                },
            )
        }
    }

    // ── Countdown ──────────────────────────────────────────────────────────

    fun start(preset: PomodoroPreset) = PomodoroTimerEngine.start(appContext, preset)
    fun pause() = PomodoroTimerEngine.pause()
    fun resume() = PomodoroTimerEngine.resume()
    fun stop() = PomodoroTimerEngine.stop()
    fun restart() = PomodoroTimerEngine.restart()
    fun skip() = PomodoroTimerEngine.skip()

    companion object {
        fun factory(
            pomodoro: PomodoroRepository,
            workout: WorkoutRepository,
            appContext: Context,
        ) = viewModelFactory {
            initializer { DashboardViewModel(pomodoro, workout, appContext) }
        }
    }
}
