package com.jackandthings.ui.workout

import com.jackandthings.model.Exercise
import com.jackandthings.model.ExerciseDraft
import com.jackandthings.model.ExerciseHistory
import com.jackandthings.model.WorkoutBest
import com.jackandthings.testing.FakeExerciseRepository
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ExerciseLibraryViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val bench = Exercise(
        id = "bench",
        name = "Bench press",
        category = "strength",
        metric = "weight_reps",
        primaryMuscle = "Chest",
        equipment = "Barbell",
    )

    private val running = Exercise(
        id = "run",
        name = "Running",
        category = "cardio",
        metric = "distance_duration",
        isCustom = true,
    )

    @Test
    fun `it loads the library`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val model = ExerciseLibraryViewModel(FakeExerciseRepository(mutableListOf(bench, running)))

        advanceUntilIdle()

        assertEquals(2, model.state.value.exercises.size)
        assertFalse(model.state.value.loading)
    }

    @Test
    fun `search matches name muscle and equipment`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = ExerciseLibraryViewModel(FakeExerciseRepository(mutableListOf(bench, running)))
            advanceUntilIdle()

            model.search("barbell")
            assertEquals(listOf(bench), model.state.value.visible)

            model.search("chest")
            assertEquals(listOf(bench), model.state.value.visible)

            model.search("runn")
            assertEquals(listOf(running), model.state.value.visible)
        }

    @Test
    fun `search ignores case`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val model = ExerciseLibraryViewModel(FakeExerciseRepository(mutableListOf(bench)))
        advanceUntilIdle()

        model.search("BENCH")

        assertEquals(listOf(bench), model.state.value.visible)
    }

    @Test
    fun `the category filter narrows the list and clearing it restores`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = ExerciseLibraryViewModel(FakeExerciseRepository(mutableListOf(bench, running)))
            advanceUntilIdle()

            model.filterBy("cardio")
            assertEquals(listOf(running), model.state.value.visible)

            model.filterBy(null)
            assertEquals(2, model.state.value.visible.size)
        }

    @Test
    fun `the categories offered are only ones actually present`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = ExerciseLibraryViewModel(FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            // Offering a filter that can only ever return nothing is worse
            // than not offering it.
            assertEquals(listOf("strength"), model.state.value.categories)
        }

    @Test
    fun `expanding an exercise fetches what the user last did with it`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val history = ExerciseHistory(
                exerciseId = "bench",
                best = WorkoutBest(bestWeightGrams = 100_000),
            )
            val repo = FakeExerciseRepository(mutableListOf(bench), history = history)
            val model = ExerciseLibraryViewModel(repo)
            advanceUntilIdle()

            model.toggle(bench)
            advanceUntilIdle()

            assertEquals("bench", model.state.value.expandedId)
            assertEquals(100_000, model.state.value.history?.best?.bestWeightGrams)
        }

    @Test
    fun `collapsing clears the history`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakeExerciseRepository(
            mutableListOf(bench),
            history = ExerciseHistory(exerciseId = "bench"),
        )
        val model = ExerciseLibraryViewModel(repo)
        advanceUntilIdle()

        model.toggle(bench)
        advanceUntilIdle()
        model.toggle(bench)
        advanceUntilIdle()

        assertNull(model.state.value.expandedId)
        assertNull(model.state.value.history)
    }

    @Test
    fun `a failing history does not hide the instructions`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeExerciseRepository(mutableListOf(bench)).apply {
                historyFailure = RuntimeException("timed out")
            }
            val model = ExerciseLibraryViewModel(repo)
            advanceUntilIdle()

            model.toggle(bench)
            advanceUntilIdle()

            // The written instructions are the point of the library; losing
            // the history should not take them down.
            assertEquals("bench", model.state.value.expandedId)
            assertNull(model.state.value.error)
        }

    @Test
    fun `saving a new exercise creates it and closes the editor`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeExerciseRepository()
            val model = ExerciseLibraryViewModel(repo)
            advanceUntilIdle()

            model.compose()
            model.save(ExerciseDraft(name = "Trap bar deadlift", category = "strength", metric = "weight_reps"))
            advanceUntilIdle()

            assertEquals(listOf("Trap bar deadlift"), repo.created.map { it.name })
            assertFalse(model.state.value.composing)
        }

    @Test
    fun `editing an exercise updates it rather than creating another`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeExerciseRepository(mutableListOf(running))
            val model = ExerciseLibraryViewModel(repo)
            advanceUntilIdle()

            model.edit(running)
            model.save(ExerciseDraft(name = "Jogging", category = "cardio", metric = "distance_duration"))
            advanceUntilIdle()

            assertTrue(repo.created.isEmpty())
            assertEquals(listOf("run"), repo.updated.map { it.first })
        }

    @Test
    fun `a refused delete is reported in the server's own words`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeExerciseRepository(mutableListOf(running)).apply {
                failure = RuntimeException("That exercise is still used by a routine or a logged set.")
            }
            val model = ExerciseLibraryViewModel(repo)
            advanceUntilIdle()

            model.delete(running)
            advanceUntilIdle()

            // The server's reason is more use than anything this layer could
            // invent, so it is passed through rather than translated.
            assertEquals(
                "That exercise is still used by a routine or a logged set.",
                model.state.value.error,
            )
        }

    @Test
    fun `cancelling the editor forgets what was being edited`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = ExerciseLibraryViewModel(FakeExerciseRepository(mutableListOf(running)))
            advanceUntilIdle()

            model.edit(running)
            model.cancelCompose()

            assertFalse(model.state.value.composing)
            assertNull(model.state.value.editing)
        }
}
