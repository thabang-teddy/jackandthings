package com.jackandthings.ui.pomodoro

import com.jackandthings.model.PomodoroPreset
import com.jackandthings.pomodoro.PomodoroTimerEngine
import com.jackandthings.pomodoro.TimerPhase
import com.jackandthings.testing.FakePomodoroRepository
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * The preset list (load, add, delete) is this ViewModel's own job. The
 * countdown itself is `PomodoroTimerEngine`'s - see `PomodoroTimerEngineTest`
 * for the tick-by-tick behaviour - so what matters here is narrower: that
 * starting/pausing/stopping actually reach the shared engine, that its state
 * shows up on `state` (via the `applyTimer` mirroring), and that deleting the
 * running preset stops it.
 *
 * The engine is a singleton shared with `DashboardViewModelTest`, so every
 * test resets it rather than trusting it to start idle.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PomodoroViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val oneMinute = PomodoroPreset("p1", "Short", focusMinutes = 1, breakMinutes = 1)

    private fun viewModel(repo: FakePomodoroRepository) = PomodoroViewModel(repo)

    @After
    fun tearDown() {
        PomodoroTimerEngine.resetForTesting()
    }

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
    fun `adding a preset reloads the list`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakePomodoroRepository()
        val model = viewModel(repo)
        advanceUntilIdle()

        model.addPreset("Deep work", 50, 10)
        advanceUntilIdle()

        assertEquals(1, model.state.value.presets.size)
        assertEquals("Deep work", model.state.value.presets.first().name)
    }

    @Test
    fun `starting reaches the shared engine and shows up on state`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = viewModel(FakePomodoroRepository(mutableListOf(oneMinute)))
            advanceUntilIdle()

            model.start(oneMinute)
            runCurrent()

            assertTrue(model.state.value.running)
            assertEquals(TimerPhase.Focus, model.state.value.phase)
            assertEquals("01:00", model.state.value.clock)

            advanceTimeBy(3_100)
            assertEquals(57, model.state.value.secondsLeft)
        }

    @Test
    fun `pause, resume, restart, skip and stop all delegate to the engine`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = viewModel(FakePomodoroRepository(mutableListOf(oneMinute)))
            advanceUntilIdle()
            model.start(oneMinute)
            runCurrent()

            model.pause()
            runCurrent()
            assertFalse(model.state.value.running)

            model.resume()
            runCurrent()
            assertTrue(model.state.value.running)

            model.skip()
            runCurrent()
            assertEquals(TimerPhase.Break, model.state.value.phase)

            model.restart()
            runCurrent()
            assertEquals(TimerPhase.Focus, model.state.value.phase)
            assertFalse(model.state.value.running)

            model.stop()
            runCurrent()
            assertNull(model.state.value.activePreset)
        }

    @Test
    fun `deleting the running preset stops the timer rather than leaving it orphaned`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakePomodoroRepository(mutableListOf(oneMinute))
            val model = viewModel(repo)
            advanceUntilIdle()
            model.start(oneMinute)
            runCurrent()

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
            runCurrent()

            model.deletePreset(other.id)
            advanceUntilIdle()

            assertNotNull(model.state.value.activePreset)
            assertEquals(oneMinute.id, model.state.value.activePreset?.id)
        }
}
