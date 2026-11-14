package com.jackandthings.ui.workout

import com.jackandthings.model.WorkoutStats
import com.jackandthings.testing.FakeTrainingRepository
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WorkoutStatsViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `it asks the server to bucket in this device's zone`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository()

            // The zone is injected rather than read from the machine, so this
            // asserts the same thing wherever the test happens to run.
            val model = WorkoutStatsViewModel(training) { "Africa/Johannesburg" }

            advanceUntilIdle()

            assertEquals(listOf("Africa/Johannesburg"), training.statsTimezones)
        }

    @Test
    fun `it loads the server's figures without recomputing them`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val stats = WorkoutStats(streakDays = 4, longestStreakDays = 9)
            val training = FakeTrainingRepository(stats = stats)
            val model = WorkoutStatsViewModel(training) { "UTC" }

            advanceUntilIdle()

            // Every figure is server-computed; the screen derives nothing but
            // bar heights, so the phone and the browser cannot disagree.
            assertEquals(4, model.state.value.stats?.streakDays)
            assertEquals(9, model.state.value.stats?.longestStreakDays)
            assertFalse(model.state.value.loading)
        }

    @Test
    fun `a failure is reported and leaves no half-drawn stats`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository().apply {
                failure = RuntimeException("Could not reach the server")
            }
            val model = WorkoutStatsViewModel(training) { "UTC" }

            advanceUntilIdle()

            assertNull(model.state.value.stats)
            assertEquals("Could not reach the server", model.state.value.error)
            assertFalse(model.state.value.loading)
        }
}
