package com.jackandthings.workout

import com.jackandthings.model.WorkoutSet
import java.util.Locale

/**
 * Display formatting for the integers the server stores.
 *
 * Kept apart from WorkoutProgress for the same reason the web app keeps
 * formatWorkout.js apart from workoutProgress.js: those rules have to match
 * the other two surfaces exactly and are tested as pure arithmetic, and
 * mixing locale-dependent formatting into them would let a locale change break
 * a personal-record comparison.
 *
 * The project is fixed metric - kilograms and kilometres - the same call it
 * makes with ZAR in Budget. Nothing here converts to pounds or miles.
 */
object WorkoutFormat {

    /** Grams as kilograms, with trailing zeroes dropped: 62500 reads "62.5 kg". */
    fun kg(grams: Int?): String? {
        if (grams == null) return null

        return "${trim(grams / 1000.0)} kg"
    }

    fun kg(grams: Long?): String? = kg(grams?.toInt())

    /** Metres under a kilometre, kilometres above: a 400 m interval is not "0.4 km". */
    fun distance(metres: Int?): String? {
        if (metres == null) return null
        if (metres < 1000) return "$metres m"

        return "${trim(metres / 1000.0)} km"
    }

    /** A clock under an hour, h/m above: a two-hour ride is not "120:00". */
    fun seconds(total: Int?): String? {
        if (total == null) return null

        if (total >= 3600) {
            val hours = total / 3600
            val minutes = ((total % 3600) + 30) / 60

            return if (minutes == 0) "${hours}h" else "${hours}h ${minutes}m"
        }

        return String.format(Locale.US, "%d:%02d", total / 60, total % 60)
    }

    /** Permille as a percentage: 175 reads "17.5%". */
    fun bodyFat(permille: Int?): String? {
        if (permille == null) return null

        return "${trim(permille / 10.0)}%"
    }

    /** Millimetres as centimetres, which is how a tape is read. */
    fun tape(millimetres: Int?): String? {
        if (millimetres == null) return null

        return "${trim(millimetres / 10.0)} cm"
    }

    /** Total volume: tonnes once it stops reading sensibly in kilograms. */
    fun volume(grams: Long): String {
        if (grams == 0L) return "0 kg"
        if (grams >= 1_000_000) return "${trim(grams / 1_000_000.0)} t"

        return "${(grams / 1000.0).toInt()} kg"
    }

    /**
     * One set as a single line - "80 kg x 5", "5 km in 24:30", "1:00" -
     * picking whichever measures the set actually carries. A dash rather than
     * an empty string when it carries none, so a row never collapses.
     */
    fun set(set: WorkoutSet): String {
        val parts = mutableListOf<String>()

        val weight = kg(set.weightGrams)
        val reps = set.reps

        when {
            weight != null && reps != null -> parts += "$weight x $reps"
            weight != null -> parts += weight
            reps != null -> parts += "$reps rep${if (reps == 1) "" else "s"}"
        }

        val distance = distance(set.distanceMetres)
        val duration = seconds(set.durationSeconds)

        when {
            distance != null && duration != null -> parts += "$distance in $duration"
            distance != null -> parts += distance
            duration != null -> parts += duration
        }

        set.rpe?.let { parts += "RPE $it" }

        return if (parts.isEmpty()) "-" else parts.joinToString(" · ")
    }

    /** Kilograms back into grams, for a form sending what the server stores. */
    fun kgToGrams(kg: String): Int? = kg.trim().takeIf { it.isNotEmpty() }
        ?.toDoubleOrNull()
        ?.let { Math.round(it * 1000).toInt() }

    /** Centimetres back into millimetres. */
    fun cmToMillimetres(cm: String): Int? = cm.trim().takeIf { it.isNotEmpty() }
        ?.toDoubleOrNull()
        ?.let { Math.round(it * 10).toInt() }

    /** A percentage back into permille. */
    fun percentToPermille(percent: String): Int? = percent.trim().takeIf { it.isNotEmpty() }
        ?.toDoubleOrNull()
        ?.let { Math.round(it * 10).toInt() }

    /** Rounds to at most two decimals and drops a pointless ".0". */
    private fun trim(value: Double): String {
        val rounded = Math.round(value * 100) / 100.0

        return if (rounded == Math.floor(rounded)) {
            rounded.toLong().toString()
        } else {
            rounded.toString()
        }
    }
}
