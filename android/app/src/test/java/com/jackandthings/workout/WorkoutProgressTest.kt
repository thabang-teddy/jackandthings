package com.jackandthings.workout

import com.jackandthings.model.WorkoutRoutineItem
import com.jackandthings.model.WorkoutSet
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin copy of the shared workout rules.
 *
 * Deliberately the same vectors as
 * laravel/resources/js/Lib/workoutProgress.test.js,
 * extension/tests/workoutProgress.test.js and
 * laravel/tests/Feature/Services/WorkoutRecordsTest.php. Where a number
 * appears in all four, it is the same number on purpose: if one copy of the
 * rules is changed alone, this file fails and says so, rather than the
 * surfaces quietly disagreeing about what a personal record is.
 */
class WorkoutProgressTest {

    // ── Which inputs an exercise asks for ──────────────────────────────────

    @Test
    fun `a weight-and-reps exercise asks for exactly those two`() {
        val fields = WorkoutProgress.fieldsFor("weight_reps")

        assertTrue(fields.weight)
        assertTrue(fields.reps)
        assertFalse(fields.distance)
        assertFalse(fields.duration)
    }

    @Test
    fun `a timed hold asks only for time`() {
        val fields = WorkoutProgress.fieldsFor("duration")

        assertFalse(fields.weight)
        assertFalse(fields.reps)
        assertFalse(fields.distance)
        assertTrue(fields.duration)
    }

    @Test
    fun `a run asks for distance and time but never a weight`() {
        val fields = WorkoutProgress.fieldsFor("distance_duration")

        assertTrue(fields.distance)
        assertTrue(fields.duration)
        assertFalse(fields.weight)
    }

    @Test
    fun `an unknown metric still lets a set be logged`() {
        // A client one version behind a newer server should degrade to the
        // commonest shape, not to a form with no inputs at all.
        val fields = WorkoutProgress.fieldsFor("something_new")

        assertTrue(fields.weight)
        assertTrue(fields.reps)
    }

    // ── Estimated one-rep max ──────────────────────────────────────────────

    @Test
    fun `a single rep is its own one-rep max`() {
        // Epley would inflate a single by a thirtieth, reporting a heavier max
        // than the user has ever actually lifted.
        assertEquals(100_000, WorkoutProgress.estimatedOneRepMax(100_000, 1))
    }

    @Test
    fun `epley applies above one rep`() {
        // The same vector the other three surfaces assert: 62.5kg x 5.
        assertEquals(72_917, WorkoutProgress.estimatedOneRepMax(62_500, 5))
    }

    @Test
    fun `it needs both a load and a rep count`() {
        assertNull(WorkoutProgress.estimatedOneRepMax(null, 5))
        assertNull(WorkoutProgress.estimatedOneRepMax(100_000, null))
        assertNull(WorkoutProgress.estimatedOneRepMax(100_000, 0))
    }

    // ── Volume ─────────────────────────────────────────────────────────────

    @Test
    fun `volume is weight times reps`() {
        assertEquals(300_000L, WorkoutProgress.volumeGrams(set(weight = 60_000, reps = 5)))
    }

    @Test
    fun `a run has no volume`() {
        // Volume is a strength measure; a 5km run contributing to it would
        // make the figure meaningless.
        val run = WorkoutSet(id = "s", exerciseId = "run", distanceMetres = 5_000, durationSeconds = 1_470)

        assertEquals(0L, WorkoutProgress.volumeGrams(run))
    }

    // ── Bests ──────────────────────────────────────────────────────────────

    @Test
    fun `warm-ups count towards nothing`() {
        val best = WorkoutProgress.bestOf(
            listOf(
                set(weight = 60_000, reps = 5),
                set(weight = 200_000, reps = 20, warmup = true),
            ),
        )

        assertEquals(60_000, best.weightGrams)
        assertEquals(5, best.reps)
    }

    @Test
    fun `a measure nothing carried is null rather than zero`() {
        val best = WorkoutProgress.bestOf(listOf(set(weight = 60_000, reps = 5)))

        // Zero would read as a terrible run rather than as "never ran".
        assertNull(best.distanceMetres)
        assertNull(best.durationSeconds)
    }

    @Test
    fun `an empty list is all nulls`() {
        assertEquals(Best(), WorkoutProgress.bestOf(emptyList()))
    }

    // ── Records ────────────────────────────────────────────────────────────

    @Test
    fun `a first-ever set is a record`() {
        assertTrue(WorkoutProgress.beatsPrevious(set(weight = 40_000, reps = 5), null))
    }

    @Test
    fun `a heavier set beats a lighter best and a lighter one does not`() {
        val previous = Best(weightGrams = 100_000, reps = 5, oneRepMaxGrams = 116_667)

        assertTrue(WorkoutProgress.beatsPrevious(set(weight = 110_000, reps = 5), previous))
        assertFalse(WorkoutProgress.beatsPrevious(set(weight = 80_000, reps = 5), previous))
    }

    @Test
    fun `more reps at a lighter load still counts`() {
        // A rep PR must not go unnoticed just because the bar was lighter.
        val previous = Best(weightGrams = 100_000, reps = 5, oneRepMaxGrams = 116_667)

        assertTrue(WorkoutProgress.beatsPrevious(set(weight = 60_000, reps = 12), previous))
    }

    @Test
    fun `a warm-up is never a record`() {
        assertFalse(
            WorkoutProgress.beatsPrevious(set(weight = 200_000, reps = 20, warmup = true), null),
        )
    }

    @Test
    fun `a measure the set does not carry is ignored rather than counted as a loss`() {
        // The set has no distance; a previous best distance must not stop its
        // weight from being a record.
        val previous = Best(distanceMetres = 5_000)

        assertTrue(WorkoutProgress.beatsPrevious(set(weight = 200_000, reps = 1), previous))
    }

    // ── Rest ───────────────────────────────────────────────────────────────

    @Test
    fun `the routine item's own rest wins`() {
        assertEquals(45, WorkoutProgress.restSecondsFor(item("squat", restSeconds = 45)))
    }

    @Test
    fun `a routine built without rest times still drives a usable timer`() {
        assertEquals(
            WorkoutProgress.DEFAULT_REST_SECONDS,
            WorkoutProgress.restSecondsFor(item("squat")),
        )
        assertEquals(WorkoutProgress.DEFAULT_REST_SECONDS, WorkoutProgress.restSecondsFor(null))
        assertEquals(
            WorkoutProgress.DEFAULT_REST_SECONDS,
            WorkoutProgress.restSecondsFor(item("squat", restSeconds = 0)),
        )
    }

    // ── What comes next ────────────────────────────────────────────────────

    private val routine = listOf(
        item("squat", position = 0, targetSets = 2, restSeconds = 60),
        item("bench", position = 1, targetSets = 1),
    )

    @Test
    fun `it starts at the first exercise`() {
        val next = requireNotNull(WorkoutProgress.nextSet(routine, emptyList()))

        assertEquals("squat", next.exerciseId)
        assertEquals(1, next.setNumber)
        assertEquals(2, next.targetSets)
        assertEquals(60, next.restSeconds)
    }

    @Test
    fun `it counts up within one exercise before moving on`() {
        val next = requireNotNull(
            WorkoutProgress.nextSet(routine, listOf(set(exerciseId = "squat"))),
        )

        assertEquals("squat", next.exerciseId)
        assertEquals(2, next.setNumber)
    }

    @Test
    fun `it moves on once a target is met`() {
        val logged = listOf(set(exerciseId = "squat"), set(exerciseId = "squat"))
        val next = requireNotNull(WorkoutProgress.nextSet(routine, logged))

        assertEquals("bench", next.exerciseId)
    }

    @Test
    fun `warm-ups do not count towards a target`() {
        // Preparation is not the work the routine asked for.
        val next = requireNotNull(
            WorkoutProgress.nextSet(routine, listOf(set(exerciseId = "squat", warmup = true))),
        )

        assertEquals(1, next.setNumber)
    }

    @Test
    fun `it follows position rather than list order`() {
        val shuffled = listOf(
            item("bench", position = 1, targetSets = 1),
            item("squat", position = 0, targetSets = 1),
        )

        assertEquals("squat", WorkoutProgress.nextSet(shuffled, emptyList())?.exerciseId)
    }

    @Test
    fun `a finished routine has no next set`() {
        val logged = listOf(
            set(exerciseId = "squat"),
            set(exerciseId = "squat"),
            set(exerciseId = "bench"),
        )

        assertNull(WorkoutProgress.nextSet(routine, logged))
    }

    // ── Progress ───────────────────────────────────────────────────────────

    @Test
    fun `progress counts target sets rather than exercises`() {
        val progress = WorkoutProgress.routineProgress(routine, emptyList())

        assertEquals(0, progress.done)
        assertEquals(3, progress.target)
        assertFalse(progress.complete)
    }

    @Test
    fun `extra sets cannot report more than the target`() {
        val many = List(9) { set(exerciseId = "squat") }
        val progress = WorkoutProgress.routineProgress(routine, many)

        assertEquals(3, progress.done)
        assertTrue(progress.complete)
    }

    private fun set(
        exerciseId: String = "squat",
        weight: Int? = null,
        reps: Int? = null,
        warmup: Boolean = false,
    ) = WorkoutSet(
        id = "set-$exerciseId-$weight-$reps-$warmup",
        exerciseId = exerciseId,
        weightGrams = weight,
        reps = reps,
        isWarmup = warmup,
    )

    private fun item(
        exerciseId: String,
        position: Int = 0,
        targetSets: Int? = null,
        restSeconds: Int? = null,
    ) = WorkoutRoutineItem(
        exerciseId = exerciseId,
        exerciseName = exerciseId,
        position = position,
        targetSets = targetSets,
        restSeconds = restSeconds,
    )
}
