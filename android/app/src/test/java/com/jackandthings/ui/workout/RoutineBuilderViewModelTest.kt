package com.jackandthings.ui.workout

import com.jackandthings.model.Exercise
import com.jackandthings.model.WorkoutRoutine
import com.jackandthings.model.WorkoutRoutineDraft
import com.jackandthings.model.WorkoutRoutineItemDraft
import com.jackandthings.testing.FakeExerciseRepository
import com.jackandthings.testing.FakeTrainingRepository
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
class RoutineBuilderViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val bench = Exercise(id = "bench", name = "Bench press", category = "strength", metric = "weight_reps")
    private val routine = WorkoutRoutine(id = "routine-1", name = "Push day")

    @Test
    fun `it loads the routines and the exercises to build from`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = RoutineBuilderViewModel(
                FakeTrainingRepository(routines = mutableListOf(routine)),
                FakeExerciseRepository(mutableListOf(bench)),
            )

            advanceUntilIdle()

            assertEquals(listOf(routine), model.state.value.routines)
            assertEquals(listOf(bench), model.state.value.exercises)
            assertFalse(model.state.value.loading)
        }

    @Test
    fun `a failing library is surfaced rather than swallowed`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val exercises = FakeExerciseRepository().apply {
                failure = RuntimeException("Could not reach the server")
            }
            val model = RoutineBuilderViewModel(FakeTrainingRepository(), exercises)

            advanceUntilIdle()

            // Unlike the live workout, there is nothing to build a routine
            // from without the library, so silence here would leave the user
            // staring at an empty picker with no explanation.
            assertEquals("Could not reach the server", model.state.value.error)
        }

    @Test
    fun `a routine is saved whole with its items`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository()
            val model = RoutineBuilderViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            model.compose()
            model.save(
                WorkoutRoutineDraft(
                    name = "Push day",
                    items = listOf(
                        WorkoutRoutineItemDraft(exerciseId = "bench", targetSets = 3, targetReps = 5),
                    ),
                ),
            )
            advanceUntilIdle()

            val draft = training.createdRoutines.single()

            assertEquals("Push day", draft.name)
            assertEquals(1, draft.items.size)
            assertEquals(3, draft.items.single().targetSets)
            assertFalse(model.state.value.composing)
        }

    @Test
    fun `editing updates rather than creating another`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(routines = mutableListOf(routine))
            val model = RoutineBuilderViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            model.edit(routine)
            model.save(WorkoutRoutineDraft(name = "Upper body"))
            advanceUntilIdle()

            assertTrue(training.createdRoutines.isEmpty())
            assertFalse(model.state.value.composing)
            assertNull(model.state.value.editing)
        }

    @Test
    fun `deleting a routine removes it`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val training = FakeTrainingRepository(routines = mutableListOf(routine))
        val model = RoutineBuilderViewModel(training, FakeExerciseRepository())
        advanceUntilIdle()

        model.delete(routine)
        advanceUntilIdle()

        assertTrue(model.state.value.routines.isEmpty())
    }

    @Test
    fun `a failed save keeps the editor open with what was typed`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository()
            val model = RoutineBuilderViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            training.failure = RuntimeException("A routine needs at least one exercise.")

            model.compose()
            model.save(WorkoutRoutineDraft(name = "Empty day"))
            advanceUntilIdle()

            // Closing the editor on a failure would throw away the work and
            // leave the user to retype it.
            assertTrue(model.state.value.composing)
            assertEquals("A routine needs at least one exercise.", model.state.value.error)
        }
}
