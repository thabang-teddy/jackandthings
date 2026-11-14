package com.jackandthings.pomodoro

import com.jackandthings.model.PomodoroPreset

/** Mirrors App\Enums\PomodoroPhase and Lib/pomodoroCycle.js. */
enum class TimerPhase(val wireValue: String, val label: String) {
    Focus("focus", "Focus"),
    ShortBreak("short_break", "Short break"),
    LongBreak("long_break", "Long break"),
    ;

    val isFocus: Boolean get() = this == Focus

    val isBreak: Boolean get() = !isFocus

    companion object {
        fun fromWire(value: String): TimerPhase =
            entries.firstOrNull { it.wireValue == value } ?: Focus
    }
}

/** What follows the phase that just ended, and whether it starts on its own. */
data class PhaseTransition(
    val phase: TimerPhase,
    val completedFocusCycles: Int,
    val autoStart: Boolean,
)

/**
 * The pure rules of a Pomodoro cycle, with no coroutines, no Context and no
 * state of their own.
 *
 * This is the Kotlin half of a rule set that three surfaces have to agree on
 * exactly - the other two are laravel/resources/js/Lib/pomodoroCycle.js and
 * extension/src/lib/pomodoroCycle.js. If they ever disagree about when the
 * long break falls, those three files are where to look.
 */
object PomodoroCycle {

    private const val SECONDS_PER_MINUTE = 60

    fun minutesFor(preset: PomodoroPreset, phase: TimerPhase): Int = when (phase) {
        TimerPhase.Focus -> preset.focusMinutes
        TimerPhase.ShortBreak -> preset.breakMinutes
        TimerPhase.LongBreak -> preset.longBreakMinutes
    }

    fun secondsFor(preset: PomodoroPreset, phase: TimerPhase): Int =
        (minutesFor(preset, phase) * SECONDS_PER_MINUTE).coerceAtLeast(0)

    /** How many focus runs precede a long break; at least one. */
    fun cycleLength(preset: PomodoroPreset): Int =
        preset.cyclesBeforeLongBreak.coerceAtLeast(1)

    /**
     * Which break follows a focus run, given how many runs are complete
     * *including* the one that just ended. Null means there is no break of
     * either length to take, so the session ends after focus - the behaviour
     * a break-less preset had before issue #3.
     */
    fun breakAfter(preset: PomodoroPreset, completedFocusCycles: Int): TimerPhase? {
        val wantsLong = completedFocusCycles > 0 &&
            completedFocusCycles % cycleLength(preset) == 0

        if (wantsLong && preset.longBreakMinutes > 0) return TimerPhase.LongBreak

        return if (preset.breakMinutes > 0) TimerPhase.ShortBreak else null
    }

    /**
     * What comes after [phase], or null when the session has nowhere to go.
     *
     * `autoStart` reads the preset's two toggles rather than deciding for
     * itself: `autoStartBreaks` governs rolling into a break, `autoStartFocus`
     * governs rolling back into work.
     */
    fun next(
        preset: PomodoroPreset,
        phase: TimerPhase,
        completedFocusCycles: Int,
    ): PhaseTransition? {
        if (phase.isFocus) {
            val completed = completedFocusCycles + 1
            val nextPhase = breakAfter(preset, completed) ?: return null

            return PhaseTransition(nextPhase, completed, preset.autoStartBreaks)
        }

        return PhaseTransition(
            phase = TimerPhase.Focus,
            // A long break closes the set, so counting starts again from it.
            completedFocusCycles = if (phase == TimerPhase.LongBreak) 0 else completedFocusCycles,
            autoStart = preset.autoStartFocus,
        )
    }

    /**
     * Where the current focus run sits in the set, 1-based, for the "3 of 4"
     * indicator. A break reports the run it follows, so the number does not
     * jump forward while you are resting.
     */
    fun position(preset: PomodoroPreset, phase: TimerPhase, completedFocusCycles: Int): Int {
        val length = cycleLength(preset)
        if (phase.isFocus) return (completedFocusCycles % length) + 1

        val completed = completedFocusCycles % length

        return if (completed == 0) length else completed
    }
}
