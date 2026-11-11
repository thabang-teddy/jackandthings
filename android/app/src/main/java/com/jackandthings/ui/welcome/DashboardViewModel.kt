package com.jackandthings.ui.welcome

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.ReminderState
import com.jackandthings.model.WorkoutPreset
import com.jackandthings.repo.PomodoroRepository
import com.jackandthings.repo.WorkoutRepository
import com.jackandthings.repo.readableMessage
import com.jackandthings.ui.pomodoro.TimerPhase
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
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
 * The countdown mirrors `Lib/useCountdown.js` - focus rolls into the break
 * and then stops - and like the web it is never persisted, since the server
 * has no session table.
 */
class DashboardViewModel(
    private val pomodoro: PomodoroRepository,
    private val workout: WorkoutRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(DashboardState())
    val state: StateFlow<DashboardState> = _state.asStateFlow()

    private var ticker: Job? = null

    init {
        refresh()
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

    fun start(preset: PomodoroPreset) {
        _state.update {
            it.copy(
                activePreset = preset,
                phase = TimerPhase.Focus,
                secondsLeft = preset.focusMinutes * SECONDS_PER_MINUTE,
                running = true,
            )
        }
        startTicking()
    }

    fun pause() {
        ticker?.cancel()
        _state.update { it.copy(running = false) }
    }

    fun resume() {
        _state.update { it.copy(running = true) }
        startTicking()
    }

    fun stop() {
        ticker?.cancel()
        _state.update {
            it.copy(
                activePreset = null,
                phase = TimerPhase.Focus,
                secondsLeft = 0,
                running = false,
            )
        }
    }

    private fun startTicking() {
        ticker?.cancel()
        ticker = viewModelScope.launch {
            while (isActive) {
                delay(1_000)
                if (!advance()) return@launch
            }
        }
    }

    /** One tick. Returns false once the timer has nothing left to count. */
    private fun advance(): Boolean {
        var keepGoing = true

        _state.update { current ->
            val preset = current.activePreset
            if (!current.running || preset == null) {
                keepGoing = false
                return@update current
            }

            val remaining = current.secondsLeft - 1
            if (remaining > 0) return@update current.copy(secondsLeft = remaining)

            // Focus rolls into the break, then the timer stops.
            if (current.phase == TimerPhase.Focus && preset.breakMinutes > 0) {
                current.copy(
                    phase = TimerPhase.Break,
                    secondsLeft = preset.breakMinutes * SECONDS_PER_MINUTE,
                )
            } else {
                keepGoing = false
                current.copy(secondsLeft = 0, running = false)
            }
        }

        return keepGoing
    }

    override fun onCleared() {
        ticker?.cancel()
    }

    companion object {
        private const val SECONDS_PER_MINUTE = 60

        fun factory(
            pomodoro: PomodoroRepository,
            workout: WorkoutRepository,
        ) = viewModelFactory {
            initializer { DashboardViewModel(pomodoro, workout) }
        }
    }
}
