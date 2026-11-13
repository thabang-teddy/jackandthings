package com.jackandthings.pomodoro

import com.jackandthings.model.PomodoroPreset
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * The shared countdown every Pomodoro screen now drives through - see the
 * engine's own doc comment for why this replaced one ticker per screen. It is
 * a singleton, so every test resets it rather than trusting JUnit to give
 * each one a fresh instance.
 *
 * Virtual time is advanced explicitly rather than with advanceUntilIdle: the
 * ticker is a loop, so idling it would run the whole session every time.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PomodoroTimerEngineTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val oneMinute = PomodoroPreset("p1", "Short", focusMinutes = 1, breakMinutes = 1)
    private val noBreak = PomodoroPreset("p2", "Focus only", focusMinutes = 1, breakMinutes = 0)

    @After
    fun tearDown() {
        PomodoroTimerEngine.resetForTesting()
    }

    @Test
    fun `starting seeds the focus phase and runs`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(oneMinute)

        val state = PomodoroTimerEngine.state.value
        assertTrue(state.running)
        assertEquals(TimerPhase.Focus, state.phase)
        assertEquals(60, state.secondsLeft)
        assertEquals("01:00", state.clock)
    }

    @Test
    fun `the clock counts down one second at a time`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(oneMinute)

        advanceTimeBy(3_100)

        assertEquals(57, PomodoroTimerEngine.state.value.secondsLeft)
    }

    @Test
    fun `focus rolls into the break when it runs out`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(oneMinute)

        advanceTimeBy(60_100)

        val state = PomodoroTimerEngine.state.value
        assertEquals(TimerPhase.ShortBreak, state.phase)
        assertEquals(60, state.secondsLeft)
        assertTrue(state.running)
    }

    /**
     * Changed by issue #3. A finished break used to end the session; it now
     * loads the next focus run and waits, because `autoStartFocus` defaults to
     * false - the classic Pomodoro behaviour, where the break starts on its
     * own but going back to work is your decision.
     */
    @Test
    fun `a finished break loads the next focus run and waits for you`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            PomodoroTimerEngine.start(oneMinute)

            advanceTimeBy(121_000)

            val state = PomodoroTimerEngine.state.value
            assertFalse(state.running)
            assertEquals(TimerPhase.Focus, state.phase)
            assertEquals(60, state.secondsLeft)
        }

    @Test
    fun `a finished break rolls straight on when the preset auto-starts focus`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            PomodoroTimerEngine.start(oneMinute.copy(autoStartFocus = true))

            advanceTimeBy(121_000)

            val state = PomodoroTimerEngine.state.value
            assertTrue(state.running)
            assertEquals(TimerPhase.Focus, state.phase)

            // A preset that auto-starts both ways never stops on its own, and
            // runTest drains the scheduler before it returns - so leaving the
            // ticker running here would hang the suite rather than fail it.
            // @After's resetForTesting() comes too late to prevent that.
            PomodoroTimerEngine.stop()
        }

    @Test
    fun `a preset with no break ends after the focus phase`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(noBreak)

        advanceTimeBy(60_100)

        assertFalse(PomodoroTimerEngine.state.value.running)
        assertEquals(TimerPhase.Focus, PomodoroTimerEngine.state.value.phase)
    }

    @Test
    fun `pausing freezes the clock`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(oneMinute)
        advanceTimeBy(5_100)

        PomodoroTimerEngine.pause()
        val atPause = PomodoroTimerEngine.state.value.secondsLeft
        advanceTimeBy(10_000)

        assertFalse(PomodoroTimerEngine.state.value.running)
        assertEquals(atPause, PomodoroTimerEngine.state.value.secondsLeft)
    }

    @Test
    fun `resuming carries on from where it paused`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(oneMinute)
        advanceTimeBy(5_100)
        PomodoroTimerEngine.pause()
        val atPause = PomodoroTimerEngine.state.value.secondsLeft

        PomodoroTimerEngine.resume()
        advanceTimeBy(2_100)

        assertTrue(PomodoroTimerEngine.state.value.running)
        assertEquals(atPause - 2, PomodoroTimerEngine.state.value.secondsLeft)
    }

    @Test
    fun `stopping clears the session entirely`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(oneMinute)
        advanceTimeBy(5_100)

        PomodoroTimerEngine.stop()

        assertEquals(PomodoroTimerState(), PomodoroTimerEngine.state.value)
    }

    @Test
    fun `restart goes back to the top of focus, paused`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(oneMinute)
        advanceTimeBy(65_100) // well into the break

        PomodoroTimerEngine.restart()

        val state = PomodoroTimerEngine.state.value
        assertEquals(TimerPhase.Focus, state.phase)
        assertEquals(60, state.secondsLeft)
        assertFalse(state.running)
    }

    @Test
    fun `restart without an active preset does nothing`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.restart()

        assertEquals(PomodoroTimerState(), PomodoroTimerEngine.state.value)
    }

    @Test
    fun `skip jumps from focus straight to the break`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(oneMinute)
        advanceTimeBy(5_100)

        PomodoroTimerEngine.skip()

        val state = PomodoroTimerEngine.state.value
        assertEquals(TimerPhase.ShortBreak, state.phase)
        assertEquals(60, state.secondsLeft)
        assertTrue(state.running)
    }

    @Test
    fun `skip from the break goes back to a full focus phase`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(oneMinute)
        advanceTimeBy(60_100) // now in the break

        PomodoroTimerEngine.skip()

        val state = PomodoroTimerEngine.state.value
        assertEquals(TimerPhase.Focus, state.phase)
        assertEquals(60, state.secondsLeft)
        assertTrue(state.running)
    }

    @Test
    fun `skipping a no-break focus session ends it, mirroring the natural roll-over`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            PomodoroTimerEngine.start(noBreak)

            PomodoroTimerEngine.skip()

            val state = PomodoroTimerEngine.state.value
            assertFalse(state.running)
            assertEquals(0, state.secondsLeft)
        }

    @Test
    fun `skipping while paused leaves it paused`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(oneMinute)
        PomodoroTimerEngine.pause()

        PomodoroTimerEngine.skip()

        val state = PomodoroTimerEngine.state.value
        assertEquals(TimerPhase.ShortBreak, state.phase)
        assertFalse(state.running)
    }

    @Test
    fun `stopIfPreset leaves a running timer alone when the id does not match`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            PomodoroTimerEngine.start(oneMinute)

            PomodoroTimerEngine.stopIfPreset("someone-elses-preset")

            assertTrue(PomodoroTimerEngine.state.value.running)
        }

    @Test
    fun `stopIfPreset stops the timer when the id matches`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        PomodoroTimerEngine.start(oneMinute)

        PomodoroTimerEngine.stopIfPreset(oneMinute.id)

        assertNull(PomodoroTimerEngine.state.value.activePreset)
        assertFalse(PomodoroTimerEngine.state.value.running)
    }
}
