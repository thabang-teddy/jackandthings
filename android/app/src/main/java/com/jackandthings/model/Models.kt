package com.jackandthings.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire models for the Laravel API in ../../laravel.
 *
 * Field names are spelled out with @SerialName rather than relying on a naming
 * strategy, so a rename on either side fails here instead of silently arriving
 * as null. Every response the API sends is wrapped in a `data` key.
 */

@Serializable
data class AuthUser(
    val id: Int,
    val name: String,
    val email: String,
)

@Serializable
data class TokenPayload(
    val token: String,
    val user: AuthUser,
)

@Serializable
data class Note(
    val id: String,
    val title: String,
    val body: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
)

@Serializable
data class PomodoroPreset(
    val id: String,
    val name: String,
    @SerialName("focus_minutes") val focusMinutes: Int,
    @SerialName("break_minutes") val breakMinutes: Int,
    @SerialName("is_default") val isDefault: Boolean = false,
)

@Serializable
data class ClipboardItem(
    val id: String,
    val title: String? = null,
    val content: String,
    @SerialName("source_device") val sourceDevice: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class RecurringTransaction(
    val id: String,
    @SerialName("account_id") val accountId: String,
    val type: String,
    @SerialName("amount_cents") val amountCents: Long,
    val description: String? = null,
    val cadence: String,
    @SerialName("next_run_at") val nextRunAt: String? = null,
    val active: Boolean = true,
    val account: AccountRef? = null,
)

@Serializable
data class WorkoutEntry(
    val id: String,
    val activity: String,
    val notes: String? = null,
    @SerialName("logged_at") val loggedAt: String? = null,
)

@Serializable
data class WorkoutPreset(
    val id: String,
    val name: String,
    val activity: String,
)

/** Reply from `workout-entries/due`. The server never sends a notification. */
@Serializable
data class ReminderState(
    val due: Boolean,
    @SerialName("last_logged_at") val lastLoggedAt: String? = null,
)

@Serializable
data class BudgetAccount(
    val id: String,
    val name: String,
    // Absent from the create/update replies, which echo the bare model.
    @SerialName("balance_cents") val balanceCents: Long = 0,
)

/** The `account:id,name` projection the transaction list eager-loads. */
@Serializable
data class AccountRef(
    val id: String,
    val name: String,
)

@Serializable
data class BudgetTransaction(
    val id: String,
    val type: String,
    @SerialName("amount_cents") val amountCents: Long,
    val description: String? = null,
    val account: AccountRef? = null,
    @SerialName("related_account") val relatedAccount: AccountRef? = null,
    @SerialName("created_at") val createdAt: String? = null,
) {
    /** Credits add to an account, debits take away. Mirrors the server enum. */
    val isCredit: Boolean get() = type == "deposit" || type == "transfer_in"

    val label: String
        get() = when (type) {
            "deposit" -> "Deposit"
            "withdrawal" -> "Withdrawal"
            "transfer_in" -> "Transfer in"
            "transfer_out" -> "Transfer out"
            else -> type
        }

    /**
     * Always reads source → destination, whichever leg of a transfer this row
     * is. On the incoming leg `account` is the destination and `relatedAccount`
     * the source, so those two swap; printing them in field order would show
     * the money flowing the wrong way.
     */
    val flowLabel: String
        get() {
            val own = account?.name ?: "—"
            val other = relatedAccount?.name ?: return own

            return if (type == "transfer_in") "$other → $own" else "$own → $other"
        }
}
