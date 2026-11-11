package com.jackandthings.repo

import java.math.BigDecimal
import java.math.RoundingMode

/** The decimal string the API expects ("125.50") from stored cents. */
internal fun Long.centsToAmountString(): String =
    BigDecimal(this).movePointLeft(2).toPlainString()

/** Cents from the decimal-string amount a user typed, or null if it isn't one. */
internal fun String.amountStringToCentsOrNull(): Long? = runCatching {
    BigDecimal(this).movePointRight(2).setScale(0, RoundingMode.HALF_UP).toLong()
}.getOrNull()
