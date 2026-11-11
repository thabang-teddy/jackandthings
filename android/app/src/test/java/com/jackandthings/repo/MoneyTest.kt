package com.jackandthings.repo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MoneyTest {

    @Test
    fun `major units become cents`() {
        assertEquals(12550L, "125.50".amountStringToCentsOrNull())
        assertEquals(100L, "1".amountStringToCentsOrNull())
        assertEquals(5L, "0.05".amountStringToCentsOrNull())
        assertEquals(0L, "0".amountStringToCentsOrNull())
    }

    @Test
    fun `a third decimal rounds to the nearer cent`() {
        assertEquals(1235L, "12.345".amountStringToCentsOrNull())
        assertEquals(1234L, "12.344".amountStringToCentsOrNull())
    }

    @Test
    fun `anything that is not a number is rejected rather than guessed at`() {
        assertNull("".amountStringToCentsOrNull())
        assertNull("R125".amountStringToCentsOrNull())
        assertNull("twelve".amountStringToCentsOrNull())
        assertNull("1,50".amountStringToCentsOrNull())
    }

    @Test
    fun `cents come back as the decimal string the API expects`() {
        assertEquals("125.50", 12550L.centsToAmountString())
        assertEquals("1.00", 100L.centsToAmountString())
        assertEquals("0.05", 5L.centsToAmountString())
        assertEquals("0.00", 0L.centsToAmountString())
    }

    @Test
    fun `a round trip through cents keeps the amount`() {
        listOf("0.01", "9.99", "125.50", "100000.00").forEach { amount ->
            val cents = amount.amountStringToCentsOrNull()
            assertEquals(amount, cents?.centsToAmountString())
        }
    }
}
