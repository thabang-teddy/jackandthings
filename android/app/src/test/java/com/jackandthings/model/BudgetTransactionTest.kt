package com.jackandthings.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The transfer-direction rule.
 *
 * This exists because the first build got it wrong: both legs were printed in
 * field order, so an incoming transfer read "Savings → Cash" when the money
 * had gone the other way. On the incoming leg `account` is the destination,
 * not the source, and the two have to swap.
 */
class BudgetTransactionTest {

    private fun transaction(
        type: String,
        account: String? = "Cash",
        related: String? = null,
    ) = BudgetTransaction(
        id = "id",
        type = type,
        amountCents = 10_000,
        account = account?.let { AccountRef("a", it) },
        relatedAccount = related?.let { AccountRef("b", it) },
    )

    @Test
    fun `an outgoing transfer reads source to destination`() {
        val row = transaction("transfer_out", account = "Cash", related = "Savings")

        assertEquals("Cash → Savings", row.flowLabel)
    }

    @Test
    fun `an incoming transfer also reads source to destination`() {
        // Same money, other leg: the owning account is now the destination.
        val row = transaction("transfer_in", account = "Savings", related = "Cash")

        assertEquals("Cash → Savings", row.flowLabel)
    }

    @Test
    fun `both legs of one transfer describe the same movement`() {
        val out = transaction("transfer_out", account = "Cash", related = "Savings")
        val into = transaction("transfer_in", account = "Savings", related = "Cash")

        assertEquals(out.flowLabel, into.flowLabel)
    }

    @Test
    fun `a plain transaction shows only its own account`() {
        assertEquals("Cash", transaction("deposit").flowLabel)
        assertEquals("Cash", transaction("withdrawal").flowLabel)
    }

    @Test
    fun `a missing account does not crash the label`() {
        assertEquals("—", transaction("deposit", account = null).flowLabel)
    }

    @Test
    fun `credits and debits are classified the way the server means them`() {
        assertTrue(transaction("deposit").isCredit)
        assertTrue(transaction("transfer_in").isCredit)
        assertFalse(transaction("withdrawal").isCredit)
        assertFalse(transaction("transfer_out").isCredit)
    }

    @Test
    fun `an unknown type is shown as-is rather than hidden`() {
        val row = transaction("something_new")

        assertEquals("something_new", row.label)
        assertFalse(row.isCredit)
    }

    @Test
    fun `known types get readable labels`() {
        assertEquals("Deposit", transaction("deposit").label)
        assertEquals("Transfer in", transaction("transfer_in").label)
        assertEquals("Transfer out", transaction("transfer_out").label)
    }
}
