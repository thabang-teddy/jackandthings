package com.jackandthings.pomodoro

import com.jackandthings.model.PomodoroPreset
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class PomodoroTimerState(
    val activePreset: PomodoroPreset? = null,
    val phase: TimerPhase = TimerPhase.Focus,
    val secondsLeft: Int = 0,
    val running: Boolean = false,
    val completedFocusCycles: Int = 0,
) {
    val clock: String
        get() = "%02d:%02d".format(secondsLeft / 60, secondsLeft % 60)

    /** Which focus run of the set is on the clock, 1-based; 0 when idle. */
    val cyclePosition: Int
        get() = activePreset?.let { PomodoroCycle.position(it, phase, completedFocusCycles) } ?: 0

    val cycleLength: Int
        get() = activePreset?.let { PomodoroCycle.cycleLength(it) } ?: 0

    /** True only while a focus run is actually running, which is when strict mode applies. */
    val strictEngaged: Boolean
        get() = running && phase.isFocus && activePreset?.strictMode == true
}

/** Something the timer did that another layer has to react to. */
sealed interface PomodoroEvent {

    /** A phase ran to its end, or was cut short by skip/stop/restart. */
    data class IntervalEnded(
        val preset: PomodoroPreset,
        val phase: TimerPhase,
        val startedAtMillis: Long,
        val endedAtMillis: Long,
        val completed: Boolean,
    ) : PomodoroEvent

    /** The clock reached zero; whoever plays sound should sound the alarm. */
    data class AlarmDue(val preset: PomodoroPreset, val endedPhase: TimerPhase) : PomodoroEvent

    /** One second passed inside a running focus run, for the optional tick. */
    data class Ticked(val preset: PomodoroPreset) : PomodoroEvent
}

/**
 * The one running Pomodoro timer, process-wide rather than owned by a
 * ViewModel - the welcome page, the Pomodoro screen, and the notification
 * would otherwise each keep their own copy and drift out of sync, which is
 * exactly what starting a timer on one screen and finding it gone on another
 * looked like before this existed.
 *
 * A *running* timer is still not persisted: it lives as long as the process
 * does. Since issue #3 a *finished* interval is, but not by this object -
 * it emits [PomodoroEvent.IntervalEnded] and PomodoroSessionRecorder decides
 * what to do with it.
 *
 * Deliberately Context-free: [com.jackandthings.JackApplication] is what
 * notices [state] going from idle to active and boots [PomodoroTimerService]
 * for it, and what subscribes sound and the Do Not Disturb guard to [events].
 * That keeps this object plain Kotlin and unit-testable without Robolectric
 * or a mocked Context. `Dispatchers.Main` rather than `Default` for the same
 * reason from the other direction - it is what `MainDispatcherRule` already
 * swaps for every other ViewModel test in this project, so the ticker comes
 * under a test's virtual-time control for free.
 */
object PomodoroTimerEngine {

    private val _state = MutableStateFlow(PomodoroTimerState())
    val state: StateFlow<PomodoroTimerState> = _state.asStateFlow()

    // Replay 0, generous buffer: a subscriber that is slow must never stall
    // the countdown, and a missed tick is not worth holding the clock for.
    private val _events = MutableSharedFlow<PomodoroEvent>(
        extraBufferCapacity = 16,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    val events: SharedFlow<PomodoroEvent> = _events.asSharedFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var ticker: Job? = null

    /** When the phase on the clock began, for the interval that gets logged. */
    private var phaseStartedAt: Long? = null

    /** Swapped in tests; the engine never reads the wall clock directly. */
    internal var now: () -> Long = System::currentTimeMillis

    fun start(preset: PomodoroPreset) {
        endCurrentInterval(completed = false)
        ticker?.cancel()
        _state.value = PomodoroTimerState(
            activePreset = preset,
            phase = TimerPhase.Focus,
            secondsLeft = PomodoroCycle.secondsFor(preset, TimerPhase.Focus),
            running = true,
            completedFocusCycles = 0,
        )
        phaseStartedAt = now()
        restartTicker()
    }

    fun pause() {
        ticker?.cancel()
        ticker = null
        _state.update { it.copy(running = false) }
    }

    fun resume() {
        if (_state.value.activePreset == null) return
        if (phaseStartedAt == null) phaseStartedAt = now()
        _state.update { it.copy(running = true) }
        restartTicker()
    }

    fun stop() {
        endCurrentInterval(completed = false)
        ticker?.cancel()
        ticker = null
        _state.value = PomodoroTimerState()
    }

    /** Back to the top of the focus phase, paused, and the set starts again. */
    fun restart() {
        val preset = _state.value.activePreset ?: return
        endCurrentInterval(completed = false)
        ticker?.cancel()
        ticker = null
        _state.update {
            it.copy(
                phase = TimerPhase.Focus,
                secondsLeft = PomodoroCycle.secondsFor(preset, TimerPhase.Focus),
                running = false,
                completedFocusCycles = 0,
            )
        }
    }

    /**
     * Jumps straight to the next phase without waiting for the clock.
     *
     * The interval is still logged, as abandoned rather than completed -
     * "I skipped four of six today" is exactly what the analytics should show.
     * Whatever running/paused state it was in is kept, rather than obeying the
     * auto-start toggle: pressing Skip is already the manual decision that
     * toggle is about.
     */
    fun skip() {
        val current = _state.value
        val preset = current.activePreset ?: return
        val wasRunning = current.running

        endCurrentInterval(completed = false)

        val transition = PomodoroCycle.next(preset, current.phase, current.completedFocusCycles)
        if (transition == null) {
            ticker?.cancel()
            ticker = null
            _state.update { it.copy(secondsLeft = 0, running = false) }
            return
        }

        enterPhase(preset, transition.phase, transition.completedFocusCycles, wasRunning)
    }

    /** Stops a timer whose preset no longer exists, called when that preset is deleted. */
    fun stopIfPreset(presetId: String) {
        if (_state.value.activePreset?.id == presetId) stop()
    }

    /** A singleton otherwise leaks state between tests, which don't share a process the way screens do. */
    internal fun resetForTesting() {
        ticker?.cancel()
        ticker = null
        phaseStartedAt = null
        now = System::currentTimeMillis
        _state.value = PomodoroTimerState()
    }

    private fun enterPhase(
        preset: PomodoroPreset,
        phase: TimerPhase,
        completedFocusCycles: Int,
        running: Boolean,
    ) {
        _state.update {
            it.copy(
                phase = phase,
                secondsLeft = PomodoroCycle.secondsFor(preset, phase),
                running = running,
                completedFocusCycles = completedFocusCycles,
            )
        }

        phaseStartedAt = if (running) now() else null

        if (running) restartTicker() else { ticker?.cancel(); ticker = null }
    }

    /**
     * Emits the interval on the clock as finished, if one was actually
     * running. A phase that was only loaded and never started has no start
     * time, so there is nothing to log and nothing is emitted.
     */
    private fun endCurrentInterval(completed: Boolean) {
        val startedAt = phaseStartedAt ?: return
        val current = _state.value
        val preset = current.activePreset ?: return

        phaseStartedAt = null

        _events.tryEmit(
            PomodoroEvent.IntervalEnded(
                preset = preset,
                phase = current.phase,
                startedAtMillis = startedAt,
                endedAtMillis = now(),
                completed = completed,
            ),
        )
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
            if (current.phase.isFocus) _events.tryEmit(PomodoroEvent.Ticked(preset))
            return true
        }

        val endedPhase = current.phase
        endCurrentInterval(completed = true)
        _events.tryEmit(PomodoroEvent.AlarmDue(preset, endedPhase))

        val transition = PomodoroCycle.next(preset, endedPhase, current.completedFocusCycles)
            ?: run {
                _state.update { it.copy(secondsLeft = 0, running = false) }
                return false
            }

        enterPhase(preset, transition.phase, transition.completedFocusCycles, transition.autoStart)

        // enterPhase restarts the ticker itself when the next phase auto-starts,
        // so this loop always ends here and never runs two tickers at once.
        return false
    }

    private const val ONE_SECOND_MS = 1_000L
}
