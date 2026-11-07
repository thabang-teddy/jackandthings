package com.jackandthings.ui.pomodoro

import com.jackandthings.model.PomodoroPreset
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Clock formatting, which is what the full-screen countdown actually shows.
 *
 * The ViewModel's own ticking is not covered here: it would need the
 * repositories behind an interface so a fake could stand in, and they are
 * concrete classes today. That refactor is noted in docs/TESTING.md.
 */
class PomodoroStateTest {

    private fun state(secondsLeft: Int) = PomodoroState(secondsLeft = secondsLeft)

    @Test
    fun `a full session reads as minutes and seconds`() {
        assertEquals("25:00", state(25 * 60).clock)
    }

    @Test
    fun `both halves are zero-padded`() {
        assertEquals("04:05", state(4 * 60 + 5).clock)
        assertEquals("00:09", state(9).clock)
    }

    @Test
    fun `a finished timer reads zero rather than going negative`() {
        assertEquals("00:00", state(0).clock)
    }

    @Test
    fun `an hour-long preset keeps counting in minutes`() {
        // 90 minutes is 90:00, not 1:30:00 — the display has no hours field.
        assertEquals("90:00", state(90 * 60).clock)
    }

    @Test
    fun `the default state is idle with nothing running`() {
        val fresh = PomodoroState()

        assertEquals(false, fresh.running)
        assertEquals(null, fresh.activePreset)
        assertEquals(TimerPhase.Focus, fresh.phase)
        assertEquals("00:00", fresh.clock)
    }

    @Test
    fun `starting from a preset seeds the focus phase`() {
        val preset = PomodoroPreset(id = "p", name = "Deep work", focusMinutes = 50, breakMinutes = 10)
        val started = PomodoroState(
            activePreset = preset,
            phase = TimerPhase.Focus,
            secondsLeft = preset.focusMinutes * 60,
            running = true,
        )

        assertEquals("50:00", started.clock)
        assertEquals(TimerPhase.Focus, started.phase)
    }
}
