package com.jackandthings.ui.pomodoro

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.pomodoro.PomodoroTimerEngine
import com.jackandthings.pomodoro.PomodoroTimerState
import com.jackandthings.pomodoro.TimerPhase
import com.jackandthings.repo.PomodoroRepository
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PomodoroState(
    val presets: List<PomodoroPreset> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
    val running: Boolean = false,
    val activePreset: PomodoroPreset? = null,
    val phase: TimerPhase = TimerPhase.Focus,
    val secondsLeft: Int = 0,
) {
    val clock: String
        get() = "%02d:%02d".format(secondsLeft / 60, secondsLeft % 60)
}

/**
 * The preset list lives here; the countdown itself lives in
 * [PomodoroTimerEngine] so it survives leaving this screen entirely (back to
 * the welcome page, say) rather than just surviving rotation within it - see
 * that object for why a single process-wide timer replaced one ticker per
 * screen.
 */
class PomodoroViewModel(
    private val repo: PomodoroRepository,
    private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(PomodoroState())
    val state: StateFlow<PomodoroState> = _state.asStateFlow()

    init {
        refresh()
        viewModelScope.launch {
            PomodoroTimerEngine.state.collect { timer -> applyTimer(timer) }
        }
    }

    private fun applyTimer(timer: PomodoroTimerState) {
        _state.update {
            it.copy(
                running = timer.running,
                activePreset = timer.activePreset,
                phase = timer.phase,
                secondsLeft = timer.secondsLeft,
            )
        }
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            repo.list().fold(
                onSuccess = { list ->
                    _state.update { it.copy(presets = list, loading = false) }
                },
                onFailure = { failure ->
                    _state.update { it.copy(loading = false, error = failure.readableMessage()) }
                },
            )
        }
    }

    fun addPreset(name: String, focusMinutes: Int, breakMinutes: Int) {
        viewModelScope.launch {
            repo.create(name, focusMinutes, breakMinutes).fold(
                onSuccess = { refresh() },
                onFailure = { failure ->
                    _state.update { it.copy(error = failure.readableMessage()) }
                },
            )
        }
    }

    fun deletePreset(id: String) {
        viewModelScope.launch {
            repo.delete(id).fold(
                onSuccess = {
                    PomodoroTimerEngine.stopIfPreset(id)
                    refresh()
                },
                onFailure = { failure ->
                    _state.update { it.copy(error = failure.readableMessage()) }
                },
            )
        }
    }

    fun start(preset: PomodoroPreset) = PomodoroTimerEngine.start(appContext, preset)
    fun pause() = PomodoroTimerEngine.pause()
    fun resume() = PomodoroTimerEngine.resume()
    fun stop() = PomodoroTimerEngine.stop()
    fun restart() = PomodoroTimerEngine.restart()
    fun skip() = PomodoroTimerEngine.skip()

    fun dismissError() = _state.update { it.copy(error = null) }

    companion object {
        fun factory(repo: PomodoroRepository, appContext: Context) = viewModelFactory {
            initializer { PomodoroViewModel(repo, appContext) }
        }
    }
}
