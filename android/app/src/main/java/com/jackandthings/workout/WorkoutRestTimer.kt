package com.jackandthings.workout

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

data class RestTimerState(
    val running: Boolean = false,
    val secondsLeft: Int = 0,
    val totalSeconds: Int = 0,
    /** What comes next, shown under the clock; null when nothing is named. */
    val label: String? = null,
) {
    val clock: String
        get() = "%02d:%02d".format(secondsLeft / 60, secondsLeft % 60)
}

/** Something the rest timer did that another layer has to react to. */
sealed interface RestTimerEvent {
    /** The rest ran out. Whoever plays sound should sound the chime. */
    data class Finished(val label: String?) : RestTimerEvent
}

/**
 * The countdown between sets, process-wide rather than owned by a ViewModel,
 * for the same reason PomodoroTimerEngine is: the live workout screen, the
 * dashboard and the notification would otherwise each keep their own copy and
 * drift, which is what a rest timer appearing to reset on navigation looks
 * like.
 *
 * Nothing about a rest is persisted, on the device or on the server. That is
 * the same line the project already drew for Pomodoro: a *running* timer is
 * never written down, and only what has already happened is. A rest that was
 * interrupted by the process dying is not worth restoring - by the time the
 * app is open again the user has either carried on or stopped.
 *
 * Deliberately Context-free, so it unit-tests without Robolectric;
 * JackApplication is what notices [state] going active and starts
 * [WorkoutRestService], and what subscribes the chime to [events].
 * `Dispatchers.Main` rather than `Default` so `MainDispatcherRule` brings the
 * ticker under a test's virtual-time control for free.
 */
object WorkoutRestTimer {

    private const val ONE_SECOND_MS = 1_000L

    private val _state = MutableStateFlow(RestTimerState())
    val state: StateFlow<RestTimerState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<RestTimerEvent>(
        extraBufferCapacity = 8,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    val events: SharedFlow<RestTimerEvent> = _events.asSharedFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var ticker: Job? = null

    /** Swapped in tests so the countdown does not depend on the wall clock. */
    internal var now: () -> Long = System::currentTimeMillis

    /** The instant the current rest is due to end; null when idle. */
    private var endsAtMillis: Long? = null

    /**
     * Starts, or restarts, a rest. A rest of zero seconds stops the timer
     * instead of starting one that is already over.
     */
    fun start(seconds: Int, label: String? = null) {
        if (seconds <= 0) {
            stop()
            return
        }

        endsAtMillis = now() + seconds * ONE_SECOND_MS
        _state.value = RestTimerState(
            running = true,
            secondsLeft = seconds,
            totalSeconds = seconds,
            label = label,
        )

        restartTicker()
    }

    /** Adds time to a running rest; does nothing when none is running. */
    fun extend(seconds: Int) {
        val endsAt = endsAtMillis ?: return

        endsAtMillis = endsAt + seconds * ONE_SECOND_MS
        _state.update {
            it.copy(
                totalSeconds = it.totalSeconds + seconds,
                secondsLeft = secondsUntil(endsAtMillis),
            )
        }
    }

    /** Ends the rest early, with no chime: the user chose to skip it. */
    fun stop() {
        ticker?.cancel()
        ticker = null
        endsAtMillis = null
        _state.value = RestTimerState()
    }

    private fun restartTicker() {
        ticker?.cancel()
        ticker = scope.launch {
            while (isActive) {
                delay(ONE_SECOND_MS)

                val remaining = secondsUntil(endsAtMillis)
                _state.update { it.copy(secondsLeft = remaining) }

                if (remaining <= 0) {
                    val label = _state.value.label
                    stop()
                    _events.tryEmit(RestTimerEvent.Finished(label))

                    return@launch
                }
            }
        }
    }

    /**
     * Recomputed from the deadline rather than decremented, so a doze or a
     * delayed coroutine resumption cannot leave the clock behind the real one.
     */
    private fun secondsUntil(endsAt: Long?): Int {
        val target = endsAt ?: return 0

        return (((target - now()) + ONE_SECOND_MS - 1) / ONE_SECOND_MS)
            .coerceAtLeast(0)
            .toInt()
    }

    /** A process-wide singleton leaks between tests; this resets it. */
    internal fun resetForTesting() {
        ticker?.cancel()
        ticker = null
        endsAtMillis = null
        now = System::currentTimeMillis
        _state.value = RestTimerState()
    }
}
