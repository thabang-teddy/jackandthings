package com.jackandthings.ui.workout

import com.jackandthings.model.ReminderState
import com.jackandthings.model.WorkoutEntry
import com.jackandthings.testing.FakeWorkoutRepository
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WorkoutViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val existing = WorkoutEntry("w-1", "Run", "5km")

    @Test
    fun `entries and reminder state load together`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeWorkoutRepository(
                mutableListOf(existing),
                ReminderState(due = true, lastLoggedAt = "yesterday"),
            )
            val model = WorkoutViewModel(repo)

            advanceUntilIdle()

            assertEquals(listOf(existing), model.state.value.entries)
            assertTrue(model.state.value.dueForReminder)
            assertEquals("yesterday", model.state.value.lastLoggedAt)
        }

    @Test
    fun `logging a workout clears the nudge`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeWorkoutRepository()
            val model = WorkoutViewModel(repo)
            advanceUntilIdle()
            assertTrue(model.state.value.dueForReminder)

            model.save("Push-ups", "3 x 20")
            advanceUntilIdle()

            assertFalse(model.state.value.dueForReminder)
            assertEquals(listOf("Push-ups" to "3 x 20"), repo.created)
        }

    @Test
    fun `a failing reminder check does not break the list`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeWorkoutRepository(mutableListOf(existing)).apply {
                reminderFailure = RuntimeException("timed out")
            }
            val model = WorkoutViewModel(repo)

            advanceUntilIdle()

            // The banner is a nicety; the entries are the point.
            assertEquals(listOf(existing), model.state.value.entries)
            assertFalse(model.state.value.loading)
        }

    @Test
    fun `a failed load surfaces the reason`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeWorkoutRepository().apply { failure = RuntimeException("offline") }
            val model = WorkoutViewModel(repo)

            advanceUntilIdle()

            assertEquals("offline", model.state.value.error)
            assertFalse(model.state.value.loading)
        }

    @Test
    fun `the activity is trimmed and empty notes become null`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeWorkoutRepository()
            val model = WorkoutViewModel(repo)
            advanceUntilIdle()

            model.save("  Cycling  ", "   ")
            advanceUntilIdle()

            assertEquals(listOf("Cycling" to null), repo.created)
        }

    @Test
    fun `a blank activity is not logged`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakeWorkoutRepository()
        val model = WorkoutViewModel(repo)
        advanceUntilIdle()
        model.startNew()

        model.save("   ", "notes")
        advanceUntilIdle()

        assertEquals(emptyList<Pair<String, String?>>(), repo.created)
        assertTrue(model.state.value.composing)
    }

    @Test
    fun `a rejected save keeps the form open with the reason`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeWorkoutRepository()
            val model = WorkoutViewModel(repo)
            advanceUntilIdle()
            model.startNew()
            repo.failure = RuntimeException("activity is too long")

            model.save("Run", null.orEmpty())
            advanceUntilIdle()

            assertTrue(model.state.value.composing)
            assertEquals("activity is too long", model.state.value.error)
            assertFalse(model.state.value.saving)
        }

    @Test
    fun `a successful save closes the form`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = WorkoutViewModel(FakeWorkoutRepository())
            advanceUntilIdle()
            model.startNew()

            model.save("Run", "")
            advanceUntilIdle()

            assertFalse(model.state.value.composing)
        }

    @Test
    fun `deleting removes the entry and reloads`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeWorkoutRepository(mutableListOf(existing))
            val model = WorkoutViewModel(repo)
            advanceUntilIdle()

            model.delete(existing.id)
            advanceUntilIdle()

            assertEquals(listOf("w-1"), repo.deletedIds)
            assertEquals(emptyList<WorkoutEntry>(), model.state.value.entries)
        }
}
