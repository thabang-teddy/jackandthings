package com.jackandthings.pomodoro

import android.content.Context
import com.jackandthings.model.PomodoroPreset
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class TimerPhase { Focus, Break }

data class PomodoroTimerState(
    val activePreset: PomodoroPreset? = null,
    val phase: TimerPhase = TimerPhase.Focus,
    val secondsLeft: Int = 0,
    val running: Boolean = false,
) {
    val clock: String
        get() = "%02d:%02d".format(secondsLeft / 60, secondsLeft % 60)
}

/**
 * The one running Pomodoro timer, process-wide rather than owned by a
 * ViewModel - the welcome page, the Pomodoro screen, and the notification
 * would otherwise each keep their own copy and drift out of sync, which is
 * exactly what starting a timer on one screen and finding it gone on another
 * looked like before this existed. Nothing here is persisted: the server has
 * no session table, by design, so a timer still only lives as long as the
 * process does - this just makes "the process" mean the whole app rather
 * than one screen's ViewModel.
 */
object PomodoroTimerEngine {

    private val _state = MutableStateFlow(PomodoroTimerState())
    val state: StateFlow<PomodoroTimerState> = _state.asStateFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var ticker: Job? = null

    fun start(context: Context, preset: PomodoroPreset) {
        ticker?.cancel()
        _state.value = PomodoroTimerState(
            activePreset = preset,
            phase = TimerPhase.Focus,
            secondsLeft = preset.focusMinutes * SECONDS_PER_MINUTE,
            running = true,
        )
        restartTicker()
        PomodoroTimerService.start(context)
    }

    fun pause() {
        ticker?.cancel()
        ticker = null
        _state.update { it.copy(running = false) }
    }

    fun resume() {
        if (_state.value.activePreset == null) return
        _state.update { it.copy(running = true) }
        restartTicker()
    }

    fun stop() {
        ticker?.cancel()
        ticker = null
        _state.value = PomodoroTimerState()
    }

    /** Back to the top of the focus phase, paused - mirrors Lib/useCountdown.js's `restart`. */
    fun restart() {
        val preset = _state.value.activePreset ?: return
        ticker?.cancel()
        ticker = null
        _state.update {
            it.copy(
                phase = TimerPhase.Focus,
                secondsLeft = preset.focusMinutes * SECONDS_PER_MINUTE,
                running = false,
            )
        }
    }

    /**
     * Jumps straight to the other phase without waiting for the clock to run
     * out. Mirrors the natural roll-over when there is no break to skip into.
     */
    fun skip() {
        val current = _state.value
        val preset = current.activePreset ?: return

        if (current.phase == TimerPhase.Focus) {
            if (preset.breakMinutes > 0) {
                _state.update {
                    it.copy(
                        phase = TimerPhase.Break,
                        secondsLeft = preset.breakMinutes * SECONDS_PER_MINUTE,
                    )
                }
            } else {
                ticker?.cancel()
                ticker = null
                _state.update { it.copy(secondsLeft = 0, running = false) }
            }
            return
        }

        _state.update {
            it.copy(phase = TimerPhase.Focus, secondsLeft = preset.focusMinutes * SECONDS_PER_MINUTE)
        }
    }

    /** Stops a timer whose preset no longer exists, called when that preset is deleted. */
    fun stopIfPreset(presetId: String) {
        if (_state.value.activePreset?.id == presetId) stop()
    }

    private fun restartTicker() {
        ticker?.cancel()
        ticker = scope.launch {
            while (isActive) {
                delay(ONE_SECOND_MS)
                if (!_state.value.running) break
                if (!advanceOneSecond()) break
            }
        }
    }

    /** Returns false once the session is over and the ticker should stop. */
    private fun advanceOneSecond(): Boolean {
        val current = _state.value
        val preset = current.activePreset ?: return false

        if (current.secondsLeft > 1) {
            _state.update { it.copy(secondsLeft = it.secondsLeft - 1) }
            return true
        }

        return if (current.phase == TimerPhase.Focus && preset.breakMinutes > 0) {
            _state.update {
                it.copy(phase = TimerPhase.Break, secondsLeft = preset.breakMinutes * SECONDS_PER_MINUTE)
            }
            true
        } else {
            _state.update { it.copy(secondsLeft = 0, running = false) }
            false
        }
    }

    private const val ONE_SECOND_MS = 1_000L
    private const val SECONDS_PER_MINUTE = 60
}
