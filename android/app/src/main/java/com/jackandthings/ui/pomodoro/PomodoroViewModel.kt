package com.jackandthings.ui.pomodoro

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.PomodoroPresetDraft
import com.jackandthings.model.PomodoroSession
import com.jackandthings.model.PomodoroStats
import com.jackandthings.pomodoro.PomodoroSounds
import com.jackandthings.pomodoro.PomodoroTimerEngine
import com.jackandthings.pomodoro.PomodoroTimerState
import com.jackandthings.pomodoro.TimerPhase
import com.jackandthings.repo.PomodoroRepository
import com.jackandthings.repo.PomodoroSessionRepository
import com.jackandthings.repo.readableMessage
import java.util.TimeZone
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
    val cyclePosition: Int = 0,
    val cycleLength: Int = 0,
    val strictEngaged: Boolean = false,
    /** True when strict mode is on but the OS has not granted the access it needs. */
    val strictBlocked: Boolean = false,
    val soundEnabled: Boolean = true,
    val stats: PomodoroStats? = null,
    val sessions: List<PomodoroSession> = emptyList(),
    val historyAvailable: Boolean = true,
) {
    val clock: String
        get() = "%02d:%02d".format(secondsLeft / 60, secondsLeft % 60)

    /** Tags already used, so the preset editor can offer them back. */
    val knownTags: List<String>
        get() = (presets.mapNotNull { it.tag } + sessions.mapNotNull { it.tag })
            .distinct()
            .sorted()
}

/**
 * The preset list, the focus history and the analytics live here; the
 * countdown itself lives in [PomodoroTimerEngine] so it survives leaving this
 * screen entirely (back to the welcome page, say) rather than just surviving
 * rotation within it.
 *
 * Recording a finished interval is deliberately *not* done here: an interval
 * that ends while no Pomodoro screen is open still has to be recorded, and
 * the timer runs behind a foreground service precisely so that happens. See
 * PomodoroSessionRecorder, wired up in JackApplication.
 */
class PomodoroViewModel(
    private val repo: PomodoroRepository,
    private val sessions: PomodoroSessionRepository,
    private val strictModeAvailable: () -> Boolean = { true },
) : ViewModel() {

    private val _state = MutableStateFlow(PomodoroState(soundEnabled = PomodoroSounds.enabled))
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
                cyclePosition = timer.cyclePosition,
                cycleLength = timer.cycleLength,
                strictEngaged = timer.strictEngaged && strictModeAvailable(),
                // Asked for, but the OS has not been told to allow it. Worth
                // saying out loud rather than letting the user believe their
                // notifications were silenced when they were not.
                strictBlocked = timer.strictEngaged && !strictModeAvailable(),
            )
        }
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            repo.list().fold(
                onSuccess = { list -> _state.update { it.copy(presets = list, loading = false) } },
                onFailure = { failure ->
                    _state.update { it.copy(loading = false, error = failure.readableMessage()) }
                },
            )
        }
        refreshHistory()
    }

    /**
     * The analytics and the recent list. A failure here is not surfaced as an
     * error: the timer is the point of this screen and must keep working when
     * the history cannot be read - signed out, for one, where there is no
     * history at all by design.
     */
    fun refreshHistory() {
        viewModelScope.launch {
            sessions.stats(TimeZone.getDefault().id)
                .onSuccess { stats -> _state.update { it.copy(stats = stats) } }

            sessions.list(RECENT_SESSION_LIMIT).fold(
                onSuccess = { list ->
                    _state.update { it.copy(sessions = list, historyAvailable = true) }
                },
                onFailure = { _state.update { it.copy(historyAvailable = false) } },
            )
        }
    }

    fun addPreset(draft: PomodoroPresetDraft) {
        viewModelScope.launch {
            repo.create(draft).fold(
                onSuccess = { refresh() },
                onFailure = { failure ->
                    _state.update { it.copy(error = failure.readableMessage()) }
                },
            )
        }
    }

    fun updatePreset(id: String, draft: PomodoroPresetDraft) {
        viewModelScope.launch {
            repo.update(id, draft).fold(
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

    fun deleteSession(id: String) {
        viewModelScope.launch {
            sessions.delete(id).fold(
                onSuccess = { refreshHistory() },
                onFailure = { failure ->
                    _state.update { it.copy(error = failure.readableMessage()) }
                },
            )
        }
    }

    fun setSoundEnabled(enabled: Boolean) {
        PomodoroSounds.enabled = enabled
        _state.update { it.copy(soundEnabled = enabled) }
    }

    fun start(preset: PomodoroPreset) = PomodoroTimerEngine.start(preset)
    fun pause() = PomodoroTimerEngine.pause()
    fun resume() = PomodoroTimerEngine.resume()
    fun skip() = PomodoroTimerEngine.skip()

    /** Stopping ends the session, so the history it just wrote is worth re-reading. */
    fun stop() {
        PomodoroTimerEngine.stop()
        refreshHistory()
    }

    fun restart() {
        PomodoroTimerEngine.restart()
        refreshHistory()
    }

    fun dismissError() = _state.update { it.copy(error = null) }

    companion object {
        private const val RECENT_SESSION_LIMIT = 30

        fun factory(
            repo: PomodoroRepository,
            sessions: PomodoroSessionRepository,
            strictModeAvailable: () -> Boolean = { true },
        ) = viewModelFactory {
            initializer { PomodoroViewModel(repo, sessions, strictModeAvailable) }
        }
    }
}
