package com.jackandthings.ui.workout

import com.jackandthings.model.Exercise
import com.jackandthings.model.WorkoutRoutine
import com.jackandthings.model.WorkoutRoutineItem
import com.jackandthings.model.WorkoutSession
import com.jackandthings.model.WorkoutSetDraft
import com.jackandthings.testing.FakeExerciseRepository
import com.jackandthings.testing.FakeTrainingRepository
import com.jackandthings.testing.MainDispatcherRule
import com.jackandthings.workout.WorkoutRestTimer
import kotlinx.coroutines.ExperimentalCoroutinesApi
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

/**
 * The live workout.
 *
 * The session itself is read from the server on every refresh rather than held
 * locally, so most of these assert that the ViewModel reflects what the
 * repository says rather than what it last did - which is what lets a workout
 * started in the browser appear on the phone.
 *
 * A note on advancing time. Logging a set starts WorkoutRestTimer, whose
 * ticker is a loop that reschedules itself every second against a real clock
 * these tests do not move - so advanceUntilIdle() would never return. Once a
 * rest is running, these tests use runCurrent(), which drains what is queued
 * now without touching the ticker's future tick. PomodoroTimerEngineTest
 * avoids idling for the same reason. The ticker itself is covered properly,
 * under a controlled clock, in WorkoutRestTimerTest.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TrainingViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val bench = Exercise(id = "bench", name = "Bench press", category = "strength", metric = "weight_reps")

    private val routine = WorkoutRoutine(
        id = "routine-1",
        name = "Push day",
        items = listOf(
            WorkoutRoutineItem(
                exerciseId = "bench",
                exerciseName = "Bench press",
                position = 0,
                targetSets = 3,
                targetReps = 5,
                restSeconds = 45,
            ),
        ),
    )

    @After
    fun tearDown() {
        // The rest timer is process-wide, so it leaks between tests.
        WorkoutRestTimer.resetForTesting()
    }

    @Test
    fun `it loads the open session the routines and the library`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(
                routines = mutableListOf(routine),
                current = WorkoutSession(id = "session-1", isOpen = true),
            )
            val model = TrainingViewModel(training, FakeExerciseRepository(mutableListOf(bench)))

            advanceUntilIdle()

            assertEquals("session-1", model.state.value.session?.id)
            assertEquals(listOf(routine), model.state.value.routines)
            assertEquals(listOf(bench), model.state.value.exercises)
            assertFalse(model.state.value.loading)
        }

    @Test
    fun `no open session is a normal state rather than an error`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = TrainingViewModel(FakeTrainingRepository(), FakeExerciseRepository())

            advanceUntilIdle()

            assertNull(model.state.value.session)
            assertNull(model.state.value.error)
        }

    @Test
    fun `a failing library does not break the workout`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val exercises = FakeExerciseRepository().apply { failure = RuntimeException("timed out") }
            val training = FakeTrainingRepository(current = WorkoutSession(id = "session-1", isOpen = true))

            val model = TrainingViewModel(training, exercises)

            advanceUntilIdle()

            // The picker is a nicety; the workout in progress is the point.
            assertEquals("session-1", model.state.value.session?.id)
        }

    @Test
    fun `starting a workout passes the chosen routine through`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(routines = mutableListOf(routine))
            val model = TrainingViewModel(training, FakeExerciseRepository())
            advanceUntilIdle()

            model.startWorkout("routine-1")
            advanceUntilIdle()

            assertEquals(listOf("routine-1"), training.startedRoutineIds)
            assertEquals("Push day", model.state.value.session?.routineName)
        }

    @Test
    fun `a freestyle workout starts with no routine`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository()
            val model = TrainingViewModel(training, FakeExerciseRepository())
            advanceUntilIdle()

            model.startWorkout(null)
            advanceUntilIdle()

            assertEquals(listOf<String?>(null), training.startedRoutineIds)
        }

    @Test
    fun `logging a set starts the rest timer from the routine's own figure`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(
                routines = mutableListOf(routine),
                current = WorkoutSession(id = "session-1", workoutRoutineId = "routine-1", isOpen = true),
            )
            val model = TrainingViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            model.logSet(WorkoutSetDraft(exerciseId = "bench", reps = 5, weightGrams = 60_000))
            runCurrent()

            // 45 seconds comes off the routine item, not the shared default.
            assertTrue(WorkoutRestTimer.state.value.running)
            assertEquals(45, WorkoutRestTimer.state.value.totalSeconds)
            assertEquals("Bench press", WorkoutRestTimer.state.value.label)

            // runTest drains the scheduler before returning, so a rest left
            // running here would hang the suite rather than fail it.
            WorkoutRestTimer.stop()
        }

    @Test
    fun `a freestyle set still rests, using the default`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(
                current = WorkoutSession(id = "session-1", isOpen = true),
            )
            val model = TrainingViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            model.logSet(WorkoutSetDraft(exerciseId = "bench", reps = 5))
            runCurrent()

            assertEquals(
                com.jackandthings.workout.WorkoutProgress.DEFAULT_REST_SECONDS,
                WorkoutRestTimer.state.value.totalSeconds,
            )

            // runTest drains the scheduler before returning, so a rest left
            // running here would hang the suite rather than fail it.
            WorkoutRestTimer.stop()
        }

    @Test
    fun `the record flag comes from the server rather than being worked out here`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(
                current = WorkoutSession(id = "session-1", isOpen = true),
            ).apply { nextSetIsRecord = true }

            val model = TrainingViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            model.logSet(WorkoutSetDraft(exerciseId = "bench", reps = 5, weightGrams = 60_000))
            runCurrent()

            // The phone and the browser must celebrate the same sets, so this
            // is the server's verdict, not a local recomputation.
            assertTrue(model.state.value.recordJustSet)

            // runTest drains the scheduler before returning, so a rest left
            // running here would hang the suite rather than fail it.
            WorkoutRestTimer.stop()
        }

    @Test
    fun `the logged set appears in the session afterwards`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(
                current = WorkoutSession(id = "session-1", isOpen = true),
            )
            val model = TrainingViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            model.logSet(WorkoutSetDraft(exerciseId = "bench", reps = 5, weightGrams = 60_000))
            runCurrent()

            assertEquals(1, model.state.value.session?.sets?.size)
            assertEquals(listOf("session-1"), training.loggedSets.map { it.first })

            // runTest drains the scheduler before returning, so a rest left
            // running here would hang the suite rather than fail it.
            WorkoutRestTimer.stop()
        }

    @Test
    fun `a failed set is reported and starts no rest`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(
                current = WorkoutSession(id = "session-1", isOpen = true),
            )
            val model = TrainingViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            training.failure = RuntimeException("no route to host")

            model.logSet(WorkoutSetDraft(exerciseId = "bench", reps = 5))
            runCurrent()

            // Resting after a set that was never recorded would be the app
            // telling the user something it does not know.
            assertFalse(WorkoutRestTimer.state.value.running)
            assertEquals("no route to host", model.state.value.error)
        }

    @Test
    fun `logging a set with no session does nothing`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository()
            val model = TrainingViewModel(training, FakeExerciseRepository())
            advanceUntilIdle()

            model.logSet(WorkoutSetDraft(exerciseId = "bench", reps = 5))
            runCurrent()

            assertTrue(training.loggedSets.isEmpty())
        }

    @Test
    fun `finishing a workout stops the rest and clears the session`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(
                current = WorkoutSession(id = "session-1", isOpen = true),
            )
            val model = TrainingViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            model.logSet(WorkoutSetDraft(exerciseId = "bench", reps = 5))
            runCurrent()
            assertTrue(WorkoutRestTimer.state.value.running)

            model.finishWorkout()
            advanceUntilIdle()

            // The rest of a finished workout is over by definition.
            assertFalse(WorkoutRestTimer.state.value.running)
            assertEquals(listOf("session-1"), training.finishedIds)
            assertNull(model.state.value.session)
        }

    @Test
    fun `the next set follows the routine as sets are logged`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(
                routines = mutableListOf(routine),
                current = WorkoutSession(id = "session-1", workoutRoutineId = "routine-1", isOpen = true),
            )
            val model = TrainingViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            assertEquals(1, model.state.value.nextSet?.setNumber)
            assertEquals("0 of 3", model.state.value.progress)

            model.logSet(WorkoutSetDraft(exerciseId = "bench", reps = 5))
            runCurrent()

            assertEquals(2, model.state.value.nextSet?.setNumber)
            assertEquals("1 of 3", model.state.value.progress)

            // runTest drains the scheduler before returning, so a rest left
            // running here would hang the suite rather than fail it.
            WorkoutRestTimer.stop()
        }

    @Test
    fun `a freestyle workout has no next set to suggest`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(
                current = WorkoutSession(id = "session-1", isOpen = true),
            )
            val model = TrainingViewModel(training, FakeExerciseRepository())
            advanceUntilIdle()

            assertNull(model.state.value.nextSet)
            assertNull(model.state.value.progress)
        }

    @Test
    fun `removing a set takes it off the session`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val training = FakeTrainingRepository(
                current = WorkoutSession(id = "session-1", isOpen = true),
            )
            val model = TrainingViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
            advanceUntilIdle()

            model.logSet(WorkoutSetDraft(exerciseId = "bench", reps = 5))
            runCurrent()

            model.deleteSet("set-1")
            // Still runCurrent: the rest started by the set above is running.
            runCurrent()

            assertEquals(listOf("set-1"), training.deletedSetIds)
            assertEquals(0, model.state.value.session?.sets?.size)

            // runTest drains the scheduler before returning, so a rest left
            // running here would hang the suite rather than fail it.
            WorkoutRestTimer.stop()
        }

    @Test
    fun `it loads what was done last time for the exercise about to be logged`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val history = com.jackandthings.model.ExerciseHistory(
                exerciseId = "bench",
                best = com.jackandthings.model.WorkoutBest(bestWeightGrams = 100_000),
            )
            val exercises = FakeExerciseRepository(mutableListOf(bench), history = history)
            val model = TrainingViewModel(
                FakeTrainingRepository(current = WorkoutSession(id = "session-1", isOpen = true)),
                exercises,
            )
            advanceUntilIdle()

            model.loadHistory("bench")
            advanceUntilIdle()

            assertEquals("bench", model.state.value.historyFor)
            assertEquals(100_000, model.state.value.history?.best?.bestWeightGrams)
        }

    @Test
    fun `it does not refetch the history for the exercise it already has`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val exercises = FakeExerciseRepository(
                mutableListOf(bench),
                history = com.jackandthings.model.ExerciseHistory(exerciseId = "bench"),
            )
            val model = TrainingViewModel(
                FakeTrainingRepository(current = WorkoutSession(id = "session-1", isOpen = true)),
                exercises,
            )
            advanceUntilIdle()

            model.loadHistory("bench")
            advanceUntilIdle()

            // The picker recomposes on every keystroke in the form beside it,
            // so a fetch per recomposition would be a request per keystroke.
            exercises.historyFailure = RuntimeException("should not be called again")
            model.loadHistory("bench")
            advanceUntilIdle()

            assertEquals("bench", model.state.value.historyFor)
        }

    @Test
    fun `logging a set invalidates the history it just made stale`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val exercises = FakeExerciseRepository(
                mutableListOf(bench),
                history = com.jackandthings.model.ExerciseHistory(exerciseId = "bench"),
            )
            val model = TrainingViewModel(
                FakeTrainingRepository(current = WorkoutSession(id = "session-1", isOpen = true)),
                exercises,
            )
            advanceUntilIdle()

            model.loadHistory("bench")
            advanceUntilIdle()
            assertEquals("bench", model.state.value.historyFor)

            model.logSet(WorkoutSetDraft(exerciseId = "bench", reps = 5))
            runCurrent()

            // The set just logged is part of this exercise's history now, so
            // showing the old answer would be one set out of date.
            assertNull(model.state.value.historyFor)

            // runTest drains the scheduler before returning, so a rest left
            // running here would hang the suite rather than fail it.
            WorkoutRestTimer.stop()
        }

    @Test
    fun `skipping the rest stops it`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val training = FakeTrainingRepository(
            current = WorkoutSession(id = "session-1", isOpen = true),
        )
        val model = TrainingViewModel(training, FakeExerciseRepository(mutableListOf(bench)))
        advanceUntilIdle()

        model.logSet(WorkoutSetDraft(exerciseId = "bench", reps = 5))
        runCurrent()

        model.skipRest()
        // The ViewModel mirrors the timer through a collector, so the new
        // state only reaches it once that coroutine gets to run. The ticker
        // is stopped by now, so idling here is safe.
        advanceUntilIdle()

        assertFalse(model.state.value.rest.running)
    }
}
