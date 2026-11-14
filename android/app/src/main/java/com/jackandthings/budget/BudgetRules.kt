package com.jackandthings.budget

import java.util.Locale

/**
 * The Budget rules every surface has to agree on: how a spending cap is
 * classified, how far a goal has come, and what a `YYYY-MM` period means.
 *
 * This is the Kotlin copy. The other two are
 * `laravel/resources/js/Lib/budgetRules.js` and `extension/src/lib/budgetRules.js`;
 * the authority is `laravel/app/Support/BudgetRules.php`. The server sends a
 * computed state with its replies, and this exists so the same badge is drawn
 * between replies without a round trip.
 *
 * Pure on purpose: integer cents and `YYYY-MM` strings, no Context, no locale,
 * no Clock. A locale change must never change whether a limit is "near".
 */
object BudgetRules {

    /** "Near" starts at 80% of the cap. */
    const val NEAR_PERCENT = 80

    const val STATE_NONE = "none"
    const val STATE_UNDER = "under"
    const val STATE_NEAR = "near"
    const val STATE_OVER = "over"

    /** Cents in, one of the four states out. A missing cap is not "under". */
    fun limitState(spentCents: Int, limitCents: Int): String = when {
        limitCents <= 0 -> STATE_NONE
        spentCents > limitCents -> STATE_OVER
        spentCents.toLong() * 100 >= limitCents.toLong() * NEAR_PERCENT -> STATE_NEAR
        else -> STATE_UNDER
    }

    /** Percentage of the cap used, deliberately not capped - 120% is worth seeing. */
    fun limitPercent(spentCents: Int, limitCents: Int): Int {
        if (limitCents <= 0) return 0

        return ((spentCents.toLong() * 100) / limitCents).toInt()
    }

    /** Capped at 100 for a progress bar; goalComplete is the separate answer. */
    fun goalPercent(savedCents: Int, targetCents: Int): Int {
        if (targetCents <= 0) return 0

        val ratio = (maxOf(0, savedCents).toLong() * 100) / targetCents

        return minOf(100L, ratio).toInt()
    }

    fun goalComplete(savedCents: Int, targetCents: Int): Boolean =
        targetCents > 0 && savedCents >= targetCents

    /** The `YYYY-MM` a `YYYY-MM-DD` date belongs to. */
    fun monthOf(date: String): String = date.take(7)

    /**
     * The inclusive first and last day of a period.
     *
     * @return start and end as `YYYY-MM-DD` strings.
     */
    fun monthBounds(period: String): Pair<String, String> {
        val (year, month) = parse(period)

        return String.format(Locale.ROOT, "%04d-%02d-01", year, month) to
            String.format(Locale.ROOT, "%04d-%02d-%02d", year, month, daysInMonth(year, month))
    }

    /** Move a `YYYY-MM` period by whole months, across year boundaries. */
    fun shiftPeriod(period: String, delta: Int): String {
        val (year, month) = parse(period)
        val index = year * 12 + (month - 1) + delta
        val newYear = index.floorDiv(12)
        val newMonth = index.mod(12) + 1

        return String.format(Locale.ROOT, "%04d-%02d", newYear, newMonth)
    }

    private fun parse(period: String): Pair<Int, Int> {
        val parts = period.split("-")

        return (parts.getOrNull(0)?.toIntOrNull() ?: 1970) to
            (parts.getOrNull(1)?.toIntOrNull() ?: 1)
    }

    private fun daysInMonth(year: Int, month: Int): Int = when (month) {
        2 -> if (isLeapYear(year)) 29 else 28
        4, 6, 9, 11 -> 30
        else -> 31
    }

    private fun isLeapYear(year: Int): Boolean =
        (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}
