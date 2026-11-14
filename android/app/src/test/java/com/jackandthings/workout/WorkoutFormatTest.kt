package com.jackandthings.workout

import com.jackandthings.model.WorkoutSet
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Turning the integers the server stores into something a person reads.
 *
 * The round trips matter most: a form reads grams, shows kilograms and sends
 * grams again, so a conversion that lost half a kilogram would silently
 * rewrite somebody's logged lift.
 */
class WorkoutFormatTest {

    @Test
    fun `a whole number of kilograms carries no pointless decimals`() {
        assertEquals("60 kg", WorkoutFormat.kg(60_000))
    }

    @Test
    fun `a half kilogram survives`() {
        assertEquals("62.5 kg", WorkoutFormat.kg(62_500))
    }

    @Test
    fun `not measured is null rather than a zero`() {
        assertNull(WorkoutFormat.kg(null as Int?))
        assertNull(WorkoutFormat.distance(null))
        assertNull(WorkoutFormat.seconds(null))
    }

    @Test
    fun `a short interval reads in metres and a long one in kilometres`() {
        // "0.4 km" for a 400m interval would read as a rounding error.
        assertEquals("400 m", WorkoutFormat.distance(400))
        assertEquals("5 km", WorkoutFormat.distance(5_000))
        assertEquals("5.25 km", WorkoutFormat.distance(5_250))
    }

    @Test
    fun `under an hour time is a clock and over it is hours`() {
        assertEquals("1:30", WorkoutFormat.seconds(90))
        assertEquals("0:05", WorkoutFormat.seconds(5))
        // "120:00" for a two-hour ride is not a reading anybody wants.
        assertEquals("2h", WorkoutFormat.seconds(7_200))
        assertEquals("1h 30m", WorkoutFormat.seconds(5_400))
    }

    @Test
    fun `permille reads as a percentage with its half point`() {
        assertEquals("17.5%", WorkoutFormat.bodyFat(175))
    }

    @Test
    fun `millimetres read as centimetres the way a tape is read`() {
        assertEquals("86 cm", WorkoutFormat.tape(860))
        assertEquals("86.5 cm", WorkoutFormat.tape(865))
    }

    @Test
    fun `a lift reads as weight by reps`() {
        assertEquals(
            "80 kg x 5",
            WorkoutFormat.set(set(weightGrams = 80_000, reps = 5)),
        )
    }

    @Test
    fun `bodyweight reps read as reps, singular when there is one`() {
        assertEquals("12 reps", WorkoutFormat.set(set(reps = 12)))
        assertEquals("1 rep", WorkoutFormat.set(set(reps = 1)))
    }

    @Test
    fun `a run reads as distance in time`() {
        assertEquals(
            "5 km in 24:30",
            WorkoutFormat.set(set(distanceMetres = 5_000, durationSeconds = 1_470)),
        )
    }

    @Test
    fun `a set with no measures is a dash rather than an empty cell`() {
        assertEquals("-", WorkoutFormat.set(set()))
    }

    @Test
    fun `rpe is appended when it is there`() {
        assertEquals("5 reps · RPE 8", WorkoutFormat.set(set(reps = 5, rpe = 8)))
    }

    @Test
    fun `volume switches to tonnes once kilograms stop reading sensibly`() {
        assertEquals("300 kg", WorkoutFormat.volume(300_000))
        assertEquals("2.5 t", WorkoutFormat.volume(2_500_000))
        assertEquals("0 kg", WorkoutFormat.volume(0))
    }

    @Test
    fun `kilograms survive the trip to grams`() {
        assertEquals(62_500, WorkoutFormat.kgToGrams("62.5"))
        assertEquals(60_000, WorkoutFormat.kgToGrams("60"))
    }

    @Test
    fun `a blank input converts to null rather than zero`() {
        assertNull(WorkoutFormat.kgToGrams(""))
        assertNull(WorkoutFormat.cmToMillimetres("  "))
        assertNull(WorkoutFormat.percentToPermille(""))
    }

    @Test
    fun `junk converts to null rather than throwing`() {
        // A number field can still receive text on some keyboards.
        assertNull(WorkoutFormat.kgToGrams("heavy"))
    }

    @Test
    fun `centimetres and percentages convert to what the server stores`() {
        assertEquals(865, WorkoutFormat.cmToMillimetres("86.5"))
        assertEquals(175, WorkoutFormat.percentToPermille("17.5"))
    }

    private fun set(
        weightGrams: Int? = null,
        reps: Int? = null,
        distanceMetres: Int? = null,
        durationSeconds: Int? = null,
        rpe: Int? = null,
    ) = WorkoutSet(
        id = "s",
        exerciseId = "e",
        weightGrams = weightGrams,
        reps = reps,
        distanceMetres = distanceMetres,
        durationSeconds = durationSeconds,
        rpe = rpe,
    )
}
