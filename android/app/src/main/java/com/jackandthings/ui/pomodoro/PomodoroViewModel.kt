package com.jackandthings.ui.pomodoro

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.repo.PomodoroRepository
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class TimerPhase { Focus, Break }

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
 * The countdown lives here rather than in the composable so it survives
 * rotation and navigation within the app. It is never persisted: the server
 * has no session table, so a timer only exists while the app does.
 */
class PomodoroViewModel(private val repo: PomodoroRepository) : ViewModel() {

    private val _state = MutableStateFlow(PomodoroState())
    val state: StateFlow<PomodoroState> = _state.asStateFlow()

    private var ticker: Job? = null

    init {
        refresh()
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
                    // Stop a timer whose preset no longer exists.
                    if (_state.value.activePreset?.id == id) stop()
                    refresh()
                },
                onFailure = { failure ->
                    _state.update { it.copy(error = failure.readableMessage()) }
                },
            )
        }
    }

    fun start(preset: PomodoroPreset) {
        _state.update {
            it.copy(
                activePreset = preset,
                phase = TimerPhase.Focus,
                secondsLeft = preset.focusMinutes * 60,
                running = true,
            )
        }
        restartTicker()
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
        _state.update {
            it.copy(
                running = false,
                activePreset = null,
                phase = TimerPhase.Focus,
                secondsLeft = 0,
            )
        }
    }

    fun dismissError() = _state.update { it.copy(error = null) }

    private fun restartTicker() {
        ticker?.cancel()
        ticker = viewModelScope.launch {
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

        // Focus rolls into the break; after the break the session is done.
        return if (current.phase == TimerPhase.Focus && preset.breakMinutes > 0) {
            _state.update {
                it.copy(phase = TimerPhase.Break, secondsLeft = preset.breakMinutes * 60)
            }
            true
        } else {
            _state.update { it.copy(secondsLeft = 0, running = false) }
            false
        }
    }

    override fun onCleared() {
        ticker?.cancel()
        super.onCleared()
    }

    companion object {
        private const val ONE_SECOND_MS = 1_000L

        fun factory(repo: PomodoroRepository) = viewModelFactory {
            initializer { PomodoroViewModel(repo) }
        }
    }
}
