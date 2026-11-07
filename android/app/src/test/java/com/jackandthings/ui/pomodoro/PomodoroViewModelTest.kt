package com.jackandthings.ui.pomodoro

import com.jackandthings.model.PomodoroPreset
import com.jackandthings.testing.FakePomodoroRepository
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * The countdown, which is the one piece of real client-side logic in the app
 * and is never persisted anywhere.
 *
 * Virtual time is advanced explicitly rather than with advanceUntilIdle: the
 * ticker is a loop, so idling it would run the whole session every time.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PomodoroViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val oneMinute = PomodoroPreset("p1", "Short", focusMinutes = 1, breakMinutes = 1)
    private val noBreak = PomodoroPreset("p2", "Focus only", focusMinutes = 1, breakMinutes = 0)

    private fun viewModel(repo: FakePomodoroRepository) = PomodoroViewModel(repo)

    @Test
    fun `presets load on creation`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakePomodoroRepository(mutableListOf(oneMinute))
        val model = viewModel(repo)

        advanceUntilIdle()

        assertEquals(listOf(oneMinute), model.state.value.presets)
        assertFalse(model.state.value.loading)
    }

    @Test
    fun `a failed load surfaces an error instead of spinning forever`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakePomodoroRepository().apply { failure = RuntimeException("no network") }
            val model = viewModel(repo)

            advanceUntilIdle()

            assertFalse(model.state.value.loading)
            assertEquals("no network", model.state.value.error)
        }

    @Test
    fun `starting a preset seeds the focus phase and runs`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = viewModel(FakePomodoroRepository(mutableListOf(oneMinute)))
            advanceUntilIdle()

            model.start(oneMinute)

            assertTrue(model.state.value.running)
            assertEquals(TimerPhase.Focus, model.state.value.phase)
            assertEquals(60, model.state.value.secondsLeft)
            assertEquals("01:00", model.state.value.clock)
        }

    @Test
    fun `the clock counts down one second at a time`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = viewModel(FakePomodoroRepository(mutableListOf(oneMinute)))
            advanceUntilIdle()
            model.start(oneMinute)

            advanceTimeBy(3_100)

            assertEquals(57, model.state.value.secondsLeft)
        }

    @Test
    fun `focus rolls into the break when it runs out`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = viewModel(FakePomodoroRepository(mutableListOf(oneMinute)))
            advanceUntilIdle()
            model.start(oneMinute)

            advanceTimeBy(60_100)

            assertEquals(TimerPhase.Break, model.state.value.phase)
            assertEquals(60, model.state.value.secondsLeft)
            assertTrue(model.state.value.running)
        }

    @Test
    fun `the session stops once the break is done`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = viewModel(FakePomodoroRepository(mutableListOf(oneMinute)))
            advanceUntilIdle()
            model.start(oneMinute)

            advanceTimeBy(121_000)

            assertFalse(model.state.value.running)
            assertEquals(0, model.state.value.secondsLeft)
        }

    @Test
    fun `a preset with no break ends after the focus phase`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = viewModel(FakePomodoroRepository(mutableListOf(noBreak)))
            advanceUntilIdle()
            model.start(noBreak)

            advanceTimeBy(60_100)

            assertFalse(model.state.value.running)
            assertEquals(TimerPhase.Focus, model.state.value.phase)
        }

    @Test
    fun `pausing freezes the clock`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val model = viewModel(FakePomodoroRepository(mutableListOf(oneMinute)))
        advanceUntilIdle()
        model.start(oneMinute)
        advanceTimeBy(5_100)

        model.pause()
        val atPause = model.state.value.secondsLeft
        advanceTimeBy(10_000)

        assertFalse(model.state.value.running)
        assertEquals(atPause, model.state.value.secondsLeft)
    }

    @Test
    fun `resuming carries on from where it paused`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = viewModel(FakePomodoroRepository(mutableListOf(oneMinute)))
            advanceUntilIdle()
            model.start(oneMinute)
            advanceTimeBy(5_100)
            model.pause()
            val atPause = model.state.value.secondsLeft

            model.resume()
            advanceTimeBy(2_100)

            assertTrue(model.state.value.running)
            assertEquals(atPause - 2, model.state.value.secondsLeft)
        }

    @Test
    fun `stopping clears the session entirely`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = viewModel(FakePomodoroRepository(mutableListOf(oneMinute)))
            advanceUntilIdle()
            model.start(oneMinute)
            advanceTimeBy(5_100)

            model.stop()

            assertNull(model.state.value.activePreset)
            assertFalse(model.state.value.running)
            assertEquals(0, model.state.value.secondsLeft)
        }

    @Test
    fun `deleting the running preset stops the timer rather than leaving it orphaned`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakePomodoroRepository(mutableListOf(oneMinute))
            val model = viewModel(repo)
            advanceUntilIdle()
            model.start(oneMinute)
            advanceTimeBy(2_100)

            model.deletePreset(oneMinute.id)
            advanceUntilIdle()

            assertNull(model.state.value.activePreset)
            assertFalse(model.state.value.running)
            assertTrue(repo.deletedIds.contains(oneMinute.id))
        }

    @Test
    fun `deleting some other preset leaves a running timer alone`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val other = PomodoroPreset("p9", "Other", 25, 5)
            val repo = FakePomodoroRepository(mutableListOf(oneMinute, other))
            val model = viewModel(repo)
            advanceUntilIdle()
            model.start(oneMinute)
            advanceTimeBy(2_100)

            model.deletePreset(other.id)
            advanceUntilIdle()

            assertNotNull(model.state.value.activePreset)
            assertEquals(oneMinute.id, model.state.value.activePreset?.id)
        }

    @Test
    fun `adding a preset reloads the list`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakePomodoroRepository()
        val model = viewModel(repo)
        advanceUntilIdle()

        model.addPreset("Deep work", 50, 10)
        advanceUntilIdle()

        assertEquals(1, model.state.value.presets.size)
        assertEquals("Deep work", model.state.value.presets.first().name)
    }
}
