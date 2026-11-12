package com.jackandthings.ui.welcome

import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.ReminderState
import com.jackandthings.model.WorkoutPreset
import com.jackandthings.pomodoro.PomodoroTimerEngine
import com.jackandthings.pomodoro.TimerPhase
import com.jackandthings.testing.FakePomodoroRepository
import com.jackandthings.testing.FakeWorkoutRepository
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DashboardViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val defaultPreset =
        PomodoroPreset("p-1", "Deep work", focusMinutes = 25, breakMinutes = 5, isDefault = true)
    private val otherPreset =
        PomodoroPreset("p-2", "Quick", focusMinutes = 10, breakMinutes = 0)

    private fun model(
        presets: MutableList<PomodoroPreset> = mutableListOf(defaultPreset),
        workout: FakeWorkoutRepository = FakeWorkoutRepository(),
    ) = DashboardViewModel(FakePomodoroRepository(presets), workout)

    @After
    fun tearDown() {
        PomodoroTimerEngine.resetForTesting()
    }

    @Test
    fun `the preset flagged default is the one offered`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = model(mutableListOf(otherPreset, defaultPreset))

            advanceUntilIdle()

            assertEquals(defaultPreset, model.state.value.defaultPreset)
        }

    @Test
    fun `with no default preset there is nothing to start from`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = model(mutableListOf(otherPreset))

            advanceUntilIdle()

            assertNull(model.state.value.defaultPreset)
        }

    @Test
    fun `reminder state stays null until it has actually been read`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val workout = FakeWorkoutRepository().apply {
                reminderFailure = RuntimeException("offline")
            }
            val model = model(workout = workout)
            assertNull(model.state.value.reminder)

            advanceUntilIdle()

            // The read failed, so the page still knows nothing about workouts
            // rather than defaulting to a claim it cannot support.
            assertNull(model.state.value.reminder)
            assertEquals("offline", model.state.value.error)
        }

    @Test
    fun `a successful read fills the reminder in`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val workout = FakeWorkoutRepository(
                reminder = ReminderState(due = false, lastLoggedAt = "2026-11-11T19:47:46+00:00"),
            )
            val model = model(workout = workout)

            advanceUntilIdle()

            assertEquals(false, model.state.value.reminder?.due)
            assertEquals("2026-11-11T19:47:46+00:00", model.state.value.reminder?.lastLoggedAt)
            assertNull(model.state.value.error)
        }

    @Test
    fun `workout presets are offered to the popup`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val workout = FakeWorkoutRepository(
                presets = mutableListOf(WorkoutPreset("wp-1", "Push day", "Push-ups")),
            )
            val model = model(workout = workout)

            advanceUntilIdle()

            assertEquals(listOf("Push day"), model.state.value.workoutPresets.map { it.name })
        }

    @Test
    fun `logging a workout sends it on and refreshes the line`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val workout = FakeWorkoutRepository()
            val model = model(workout = workout)
            advanceUntilIdle()
            assertTrue(model.state.value.reminder?.due == true)

            var closed = false
            model.logWorkout("Push-ups", "3 x 20") { closed = true }
            advanceUntilIdle()

            assertEquals(listOf("Push-ups" to "3 x 20"), workout.created)
            assertTrue(closed)
            // The fake clears the nudge the way the server would.
            assertFalse(model.state.value.reminder?.due ?: true)
        }

    @Test
    fun `a blank activity is not sent`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val workout = FakeWorkoutRepository()
            val model = model(workout = workout)
            advanceUntilIdle()

            model.logWorkout("   ", "") { }
            advanceUntilIdle()

            assertTrue(workout.created.isEmpty())
        }

    @Test
    fun `a failed log surfaces the reason and leaves the popup open`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val workout = FakeWorkoutRepository().apply { failure = RuntimeException("no route") }
            val model = model(workout = workout)
            advanceUntilIdle()

            var closed = false
            model.logWorkout("Push-ups", "") { closed = true }
            advanceUntilIdle()

            assertFalse(closed)
            assertEquals("no route", model.state.value.error)
            assertFalse(model.state.value.saving)
        }

    // ── Countdown ──────────────────────────────────────────────────────────
    //
    // This is the same shared PomodoroTimerEngine the Pomodoro screen uses -
    // see PomodoroTimerEngineTest for the tick-by-tick behaviour. What is
    // specific to this ViewModel is that it mirrors the engine's state at
    // all, and that `idle` reads correctly off it.

    @Test
    fun `starting runs the focus phase down`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = model()
            advanceUntilIdle()

            model.start(defaultPreset)
            runCurrent()
            assertEquals(25 * 60, model.state.value.secondsLeft)
            assertTrue(model.state.value.running)
            assertFalse(model.state.value.idle)

            advanceTimeBy(3_100)

            assertEquals(25 * 60 - 3, model.state.value.secondsLeft)
            assertEquals(TimerPhase.Focus, model.state.value.phase)
        }

    @Test
    fun `pausing stops the clock and resuming picks it back up`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = model()
            advanceUntilIdle()

            model.start(defaultPreset)
            advanceTimeBy(2_100)
            val atPause = model.state.value.secondsLeft

            model.pause()
            advanceTimeBy(5_000)

            assertFalse(model.state.value.running)
            assertEquals(atPause, model.state.value.secondsLeft)

            model.resume()
            advanceTimeBy(1_100)

            assertTrue(model.state.value.running)
            assertEquals(atPause - 1, model.state.value.secondsLeft)
        }

    @Test
    fun `stopping clears the timer back to idle`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = model()
            advanceUntilIdle()

            model.start(defaultPreset)
            advanceTimeBy(5_100)
            model.stop()
            runCurrent()

            assertTrue(model.state.value.idle)
            assertFalse(model.state.value.running)
            assertEquals(0, model.state.value.secondsLeft)
        }
}
