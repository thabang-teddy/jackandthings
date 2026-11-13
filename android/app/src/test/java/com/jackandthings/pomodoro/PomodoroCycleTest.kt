package com.jackandthings.pomodoro

import com.jackandthings.model.PomodoroPreset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin copy of the cycle rules.
 *
 * Deliberately the same cases as laravel/resources/js/Lib/pomodoroCycle.test.js
 * and extension/tests/pomodoroCycle.test.js. Three implementations have to
 * agree about when the long break falls, and three test files asserting the
 * same sequence is what turns a divergence into a failing build rather than
 * into a user noticing their phone and their browser disagreeing.
 *
 * Pure functions, so no coroutines, no Robolectric and no engine state - this
 * is the half of the timer that is worth pinning exactly.
 */
class PomodoroCycleTest {

    private val classic = PomodoroPreset(
        id = "p1",
        name = "Classic 25/5",
        focusMinutes = 25,
        breakMinutes = 5,
        longBreakMinutes = 15,
        cyclesBeforeLongBreak = 4,
    )

    // ── Durations ─────────────────────────────────────────────────────────

    @Test
    fun `each phase reads its own field`() {
        assertEquals(25, PomodoroCycle.minutesFor(classic, TimerPhase.Focus))
        assertEquals(5, PomodoroCycle.minutesFor(classic, TimerPhase.ShortBreak))
        assertEquals(15, PomodoroCycle.minutesFor(classic, TimerPhase.LongBreak))
    }

    @Test
    fun `seconds are minutes, and never negative`() {
        assertEquals(1500, PomodoroCycle.secondsFor(classic, TimerPhase.Focus))
        assertEquals(
            0,
            PomodoroCycle.secondsFor(classic.copy(breakMinutes = -5), TimerPhase.ShortBreak),
        )
    }

    @Test
    fun `a preset from a server that predates the long break still runs`() {
        // The model defaults stand in, so the timer behaves as it did before
        // issue #3 rather than producing a zero-length phase.
        val old = PomodoroPreset(id = "p2", name = "Old", focusMinutes = 50, breakMinutes = 10)

        assertEquals(15, PomodoroCycle.minutesFor(old, TimerPhase.LongBreak))
        assertEquals(4, PomodoroCycle.cycleLength(old))
    }

    // ── Which break follows a focus run ───────────────────────────────────

    @Test
    fun `a short break follows the runs that are not the fourth`() {
        assertEquals(TimerPhase.ShortBreak, PomodoroCycle.breakAfter(classic, 1))
        assertEquals(TimerPhase.ShortBreak, PomodoroCycle.breakAfter(classic, 2))
        assertEquals(TimerPhase.ShortBreak, PomodoroCycle.breakAfter(classic, 3))
    }

    @Test
    fun `the long break lands on every fourth run`() {
        assertEquals(TimerPhase.LongBreak, PomodoroCycle.breakAfter(classic, 4))
        assertEquals(TimerPhase.LongBreak, PomodoroCycle.breakAfter(classic, 8))
    }

    @Test
    fun `a preset with no long break takes the short one every time`() {
        val noLong = classic.copy(longBreakMinutes = 0)

        assertEquals(TimerPhase.ShortBreak, PomodoroCycle.breakAfter(noLong, 4))
    }

    @Test
    fun `a preset with no break of either length has nowhere to go`() {
        val focusOnly = classic.copy(breakMinutes = 0, longBreakMinutes = 0)

        assertNull(PomodoroCycle.breakAfter(focusOnly, 1))
        assertNull(PomodoroCycle.next(focusOnly, TimerPhase.Focus, 0))
    }

    @Test
    fun `a cycle length below one would make every run a long break`() {
        // Guarded: n % 0 divides by zero and n % 1 is always 0.
        assertEquals(1, PomodoroCycle.cycleLength(classic.copy(cyclesBeforeLongBreak = 0)))
        assertEquals(
            TimerPhase.LongBreak,
            PomodoroCycle.breakAfter(classic.copy(cyclesBeforeLongBreak = 0), 1),
        )
    }

    // ── The sequence ──────────────────────────────────────────────────────

    @Test
    fun `a full set runs short, short, short, long`() {
        // The same sequence the other two surfaces assert, end to end.
        val phases = mutableListOf<TimerPhase>()
        var phase = TimerPhase.Focus
        var completed = 0

        repeat(8) {
            val next = requireNotNull(PomodoroCycle.next(classic, phase, completed))
            phases += next.phase
            phase = next.phase
            completed = next.completedFocusCycles
        }

        assertEquals(
            listOf(
                TimerPhase.ShortBreak,
                TimerPhase.Focus,
                TimerPhase.ShortBreak,
                TimerPhase.Focus,
                TimerPhase.ShortBreak,
                TimerPhase.Focus,
                TimerPhase.LongBreak,
                TimerPhase.Focus,
            ),
            phases,
        )
    }

    @Test
    fun `a short break goes back to focus without disturbing the count`() {
        val next = requireNotNull(PomodoroCycle.next(classic, TimerPhase.ShortBreak, 2))

        assertEquals(TimerPhase.Focus, next.phase)
        assertEquals(2, next.completedFocusCycles)
    }

    @Test
    fun `a long break closes the set, so counting starts again`() {
        val next = requireNotNull(PomodoroCycle.next(classic, TimerPhase.LongBreak, 4))

        assertEquals(TimerPhase.Focus, next.phase)
        assertEquals(0, next.completedFocusCycles)
    }

    // ── Auto-start ────────────────────────────────────────────────────────

    @Test
    fun `the defaults are the traditional Pomodoro behaviour`() {
        // A break begins on its own; going back to work is your decision.
        assertTrue(requireNotNull(PomodoroCycle.next(classic, TimerPhase.Focus, 0)).autoStart)
        assertEquals(
            false,
            requireNotNull(PomodoroCycle.next(classic, TimerPhase.ShortBreak, 1)).autoStart,
        )
    }

    @Test
    fun `each toggle governs its own direction`() {
        val flipped = classic.copy(autoStartBreaks = false, autoStartFocus = true)

        assertEquals(
            false,
            requireNotNull(PomodoroCycle.next(flipped, TimerPhase.Focus, 0)).autoStart,
        )
        assertTrue(requireNotNull(PomodoroCycle.next(flipped, TimerPhase.ShortBreak, 1)).autoStart)
    }

    // ── Position ──────────────────────────────────────────────────────────

    @Test
    fun `focus runs count from one`() {
        assertEquals(1, PomodoroCycle.position(classic, TimerPhase.Focus, 0))
        assertEquals(3, PomodoroCycle.position(classic, TimerPhase.Focus, 2))
    }

    @Test
    fun `a break reports the run it follows rather than jumping ahead`() {
        assertEquals(1, PomodoroCycle.position(classic, TimerPhase.ShortBreak, 1))
    }

    @Test
    fun `the long break reports the end of the set rather than wrapping to zero`() {
        assertEquals(4, PomodoroCycle.position(classic, TimerPhase.LongBreak, 4))
    }

    // ── Wire values ───────────────────────────────────────────────────────

    @Test
    fun `the phase names match the ones the server stores`() {
        // App\Enums\PomodoroPhase. A rename on either side has to fail here
        // rather than arrive as a 422 on a logged session.
        assertEquals("focus", TimerPhase.Focus.wireValue)
        assertEquals("short_break", TimerPhase.ShortBreak.wireValue)
        assertEquals("long_break", TimerPhase.LongBreak.wireValue)
    }

    @Test
    fun `a phase name from a newer client degrades to focus rather than crashing`() {
        assertEquals(TimerPhase.Focus, TimerPhase.fromWire("napping"))
        assertEquals(TimerPhase.LongBreak, TimerPhase.fromWire("long_break"))
    }

    @Test
    fun `both breaks are breaks and focus is not`() {
        assertTrue(TimerPhase.ShortBreak.isBreak)
        assertTrue(TimerPhase.LongBreak.isBreak)
        assertTrue(TimerPhase.Focus.isFocus)
        assertEquals(false, TimerPhase.Focus.isBreak)
    }
}
