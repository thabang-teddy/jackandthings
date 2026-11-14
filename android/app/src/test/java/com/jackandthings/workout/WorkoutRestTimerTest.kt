package com.jackandthings.workout

import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.Rule

/**
 * The countdown between sets.
 *
 * Like PomodoroTimerEngine it is a process-wide singleton, so every test
 * resets it rather than trusting JUnit for a fresh instance, and its clock is
 * injected so the assertions do not depend on the wall clock. Virtual time is
 * advanced explicitly: the ticker is a loop, and idling it would run the whole
 * rest every time.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class WorkoutRestTimerTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    /** Moved by hand so the deadline arithmetic is under the test's control. */
    private var clock = 0L

    @After
    fun tearDown() {
        WorkoutRestTimer.resetForTesting()
    }

    private fun useFakeClock() {
        clock = 1_000_000L
        WorkoutRestTimer.now = { clock }
    }

    @Test
    fun `starting a rest sets the clock running`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        useFakeClock()

        WorkoutRestTimer.start(60, label = "Bench press")

        val state = WorkoutRestTimer.state.value

        assertTrue(state.running)
        assertEquals(60, state.secondsLeft)
        assertEquals(60, state.totalSeconds)
        assertEquals("Bench press", state.label)
        assertEquals("01:00", state.clock)

        // runTest drains the scheduler before it returns, so a ticker left
        // running here would hang the suite rather than fail it - @After's
        // resetForTesting() comes too late. Same trap PomodoroTimerEngineTest
        // documents.
        WorkoutRestTimer.stop()
    }

    @Test
    fun `a zero-second rest does not start one`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        useFakeClock()

        // Starting a rest that is already over would show a 0:00 bar nobody
        // asked for and then immediately chime.
        WorkoutRestTimer.start(0)

        assertFalse(WorkoutRestTimer.state.value.running)
    }

    @Test
    fun `the clock counts down as time passes`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        useFakeClock()

        WorkoutRestTimer.start(60)

        clock += 10_000
        advanceTimeBy(10_001)

        assertEquals(50, WorkoutRestTimer.state.value.secondsLeft)

        WorkoutRestTimer.stop()
    }

    @Test
    fun `it recomputes from the deadline rather than counting ticks`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            useFakeClock()

            WorkoutRestTimer.start(60)

            // A doze, or a throttled background coroutine: thirty seconds of
            // real time pass while only one tick fires. Decrementing per tick
            // would leave the clock reading 59.
            clock += 30_000
            advanceTimeBy(1_001)

            assertEquals(30, WorkoutRestTimer.state.value.secondsLeft)

            WorkoutRestTimer.stop()
        }

    @Test
    fun `reaching zero finishes the rest and emits the event`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            useFakeClock()

            // backgroundScope rather than a scope of our own: runTest cancels
            // it at the end, so a collector on a never-completing SharedFlow
            // cannot hang the test.
            val events = mutableListOf<RestTimerEvent>()
            backgroundScope.launch {
                WorkoutRestTimer.events.collect { events.add(it) }
            }

            WorkoutRestTimer.start(2, label = "Bench press")

            clock += 2_000
            advanceTimeBy(2_001)

            assertFalse(WorkoutRestTimer.state.value.running)
            assertEquals(listOf(RestTimerEvent.Finished("Bench press")), events)
        }

    @Test
    fun `extending a running rest adds to both the clock and the total`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            useFakeClock()

            WorkoutRestTimer.start(60)
            WorkoutRestTimer.extend(30)

            val state = WorkoutRestTimer.state.value

            assertEquals(90, state.secondsLeft)
            assertEquals(90, state.totalSeconds)

            WorkoutRestTimer.stop()
        }

    @Test
    fun `extending when nothing is running does nothing`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            useFakeClock()

            WorkoutRestTimer.extend(30)

            assertFalse(WorkoutRestTimer.state.value.running)
        }

    @Test
    fun `skipping ends the rest without a chime`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            useFakeClock()

            val events = mutableListOf<RestTimerEvent>()
            backgroundScope.launch {
                WorkoutRestTimer.events.collect { events.add(it) }
            }

            WorkoutRestTimer.start(60)
            WorkoutRestTimer.stop()

            advanceTimeBy(2_000)

            // The user chose to skip, so sounding the end-of-rest chime at
            // them would be the app arguing with them.
            assertFalse(WorkoutRestTimer.state.value.running)
            assertTrue(events.isEmpty())
        }

    @Test
    fun `starting a second rest replaces the first`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            useFakeClock()

            WorkoutRestTimer.start(60, label = "Bench press")
            WorkoutRestTimer.start(30, label = "Back squat")

            val state = WorkoutRestTimer.state.value

            assertEquals(30, state.secondsLeft)
            assertEquals("Back squat", state.label)

            WorkoutRestTimer.stop()
        }
}
