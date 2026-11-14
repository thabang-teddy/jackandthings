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
    /** Starred notes are the ones the home screen pins; see docs/PRD.md F-01. */
    @SerialName("is_starred") val isStarred: Boolean = false,
    @SerialName("updated_at") val updatedAt: String? = null,
)

@Serializable
data class PomodoroPreset(
    val id: String,
    val name: String,
    @SerialName("focus_minutes") val focusMinutes: Int,
    @SerialName("break_minutes") val breakMinutes: Int,
    @SerialName("long_break_minutes") val longBreakMinutes: Int = 15,
    @SerialName("cycles_before_long_break") val cyclesBeforeLongBreak: Int = 4,
    @SerialName("auto_start_breaks") val autoStartBreaks: Boolean = true,
    @SerialName("auto_start_focus") val autoStartFocus: Boolean = false,
    /** Labels every interval this preset runs, for the analytics breakdown. */
    val tag: String? = null,
    @SerialName("alarm_sound") val alarmSound: String = "chime",
    @SerialName("ticking_sound") val tickingSound: String = "none",
    val ambience: String = "none",
    /** Asks the OS to silence notifications while focusing; see FocusGuard. */
    @SerialName("strict_mode") val strictMode: Boolean = false,
    /** Host patterns the browser add-on blocks; Android stores but cannot enforce them. */
    @SerialName("blocked_sites") val blockedSites: List<String> = emptyList(),
    @SerialName("is_default") val isDefault: Boolean = false,
) {
    /** Every field of a preset except the ones the server assigns. */
    fun toDraft(): PomodoroPresetDraft = PomodoroPresetDraft(
        name = name,
        focusMinutes = focusMinutes,
        breakMinutes = breakMinutes,
        longBreakMinutes = longBreakMinutes,
        cyclesBeforeLongBreak = cyclesBeforeLongBreak,
        autoStartBreaks = autoStartBreaks,
        autoStartFocus = autoStartFocus,
        tag = tag,
        alarmSound = alarmSound,
        tickingSound = tickingSound,
        ambience = ambience,
        strictMode = strictMode,
        blockedSites = blockedSites,
        isDefault = isDefault,
    )
}

/**
 * What a client sends to create a preset.
 *
 * A single object rather than fourteen positional arguments threaded through
 * the repository chain, the outbox and the sync manager - which is what this
 * was before issue #3 grew a preset past four fields, and what would have
 * made every one of those layers a place to drop a field silently.
 */
@Serializable
data class PomodoroPresetDraft(
    val name: String,
    @SerialName("focus_minutes") val focusMinutes: Int,
    @SerialName("break_minutes") val breakMinutes: Int,
    @SerialName("long_break_minutes") val longBreakMinutes: Int = 15,
    @SerialName("cycles_before_long_break") val cyclesBeforeLongBreak: Int = 4,
    @SerialName("auto_start_breaks") val autoStartBreaks: Boolean = true,
    @SerialName("auto_start_focus") val autoStartFocus: Boolean = false,
    val tag: String? = null,
    @SerialName("alarm_sound") val alarmSound: String = "chime",
    @SerialName("ticking_sound") val tickingSound: String = "none",
    val ambience: String = "none",
    @SerialName("strict_mode") val strictMode: Boolean = false,
    @SerialName("blocked_sites") val blockedSites: List<String> = emptyList(),
    @SerialName("is_default") val isDefault: Boolean = false,
) {
    fun toPreset(id: String): PomodoroPreset = PomodoroPreset(
        id = id,
        name = name,
        focusMinutes = focusMinutes,
        breakMinutes = breakMinutes,
        longBreakMinutes = longBreakMinutes,
        cyclesBeforeLongBreak = cyclesBeforeLongBreak,
        autoStartBreaks = autoStartBreaks,
        autoStartFocus = autoStartFocus,
        tag = tag,
        alarmSound = alarmSound,
        tickingSound = tickingSound,
        ambience = ambience,
        strictMode = strictMode,
        blockedSites = blockedSites,
        isDefault = isDefault,
    )
}

/**
 * One finished Pomodoro interval, as the server stores it.
 *
 * A *running* timer is still never persisted anywhere - see
 * PomodoroTimerEngine. Only an interval that has ended is written, which is
 * what the focus analytics are read from.
 */
@Serializable
data class PomodoroSession(
    val id: String,
    @SerialName("pomodoro_preset_id") val presetId: String? = null,
    @SerialName("preset_name") val presetName: String,
    val tag: String? = null,
    val phase: String,
    @SerialName("started_at") val startedAt: String,
    @SerialName("ended_at") val endedAt: String,
    @SerialName("duration_seconds") val durationSeconds: Int,
    val completed: Boolean = true,
    val source: String? = null,
)

/** A session on its way to the server, before it has an id. */
@Serializable
data class PomodoroSessionDraft(
    @SerialName("pomodoro_preset_id") val presetId: String? = null,
    @SerialName("preset_name") val presetName: String,
    val tag: String? = null,
    val phase: String,
    @SerialName("started_at") val startedAt: String,
    @SerialName("ended_at") val endedAt: String,
    @SerialName("duration_seconds") val durationSeconds: Int,
    val completed: Boolean = true,
    val source: String = "android",
)

/** Totals and buckets from `GET pomodoro-sessions/stats`. */
@Serializable
data class PomodoroStats(
    val timezone: String = "UTC",
    val today: PomodoroTotals = PomodoroTotals(),
    val week: PomodoroTotals = PomodoroTotals(),
    val history: PomodoroTotals = PomodoroTotals(),
    val days: List<PomodoroDayBucket> = emptyList(),
    val hours: List<PomodoroHourBucket> = emptyList(),
    val tags: List<PomodoroTagBucket> = emptyList(),
    @SerialName("most_productive_hour") val mostProductiveHour: Int? = null,
    @SerialName("streak_days") val streakDays: Int = 0,
    @SerialName("completion_rate") val completionRate: Double? = null,
    @SerialName("history_days") val historyDays: Int = 90,
)

@Serializable
data class PomodoroTotals(
    @SerialName("focus_seconds") val focusSeconds: Int = 0,
    val intervals: Int = 0,
)

@Serializable
data class PomodoroDayBucket(
    val date: String,
    val label: String,
    @SerialName("focus_seconds") val focusSeconds: Int = 0,
    val intervals: Int = 0,
)

@Serializable
data class PomodoroHourBucket(
    val hour: Int,
    @SerialName("focus_seconds") val focusSeconds: Int = 0,
    val intervals: Int = 0,
)

@Serializable
data class PomodoroTagBucket(
    val tag: String? = null,
    @SerialName("focus_seconds") val focusSeconds: Int = 0,
    val intervals: Int = 0,
)

@Serializable
data class WatchList(
    val id: String,
    val name: String,
    val items: List<WatchListItem> = emptyList(),
)

@Serializable
data class WatchListItem(
    val id: String,
    @SerialName("watch_list_id") val watchListId: String? = null,
    val title: String,
    val note: String? = null,
    val done: Boolean = false,
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

/**
 * The account projection the transaction list eager-loads. The API flattens
 * it to its name and sends the id alongside, which is why these are strings
 * rather than an [AccountRef] object: `laravel/app/Http/Resources/
 * BudgetTransactionPayload` is the wire contract.
 */
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
    @SerialName("account_id") val accountId: String? = null,
    val account: String? = null,
    @SerialName("related_account_id") val relatedAccountId: String? = null,
    @SerialName("related_account") val relatedAccount: String? = null,
    @SerialName("category_id") val categoryId: String? = null,
    val category: String? = null,
    /** The business date of the money movement, not when the row was written. */
    @SerialName("occurred_on") val occurredOn: String? = null,
    val merchant: String? = null,
    val receipt: BudgetReceipt? = null,
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
            val own = account ?: "—"
            val other = relatedAccount ?: return own

            return if (type == "transfer_in") "$other → $own" else "$own → $other"
        }
}

/** One spending or income bucket; seeded by the server on first read. */
@Serializable
data class BudgetCategory(
    val id: String,
    val name: String,
    val kind: String,
    @SerialName("kind_label") val kindLabel: String = "",
) {
    val isIncome: Boolean get() = kind == "income"
}

/** A category cap and the server's verdict on how much of it is used. */
@Serializable
data class BudgetLimitState(
    val id: String,
    @SerialName("category_id") val categoryId: String,
    val category: String = "Category",
    /** Absent from the grouped report query, so the screen carries its own. */
    val period: String = "",
    @SerialName("limit_cents") val limitCents: Long,
    @SerialName("spent_cents") val spentCents: Long = 0,
    val state: String = "none",
    val percent: Int = 0,
)

@Serializable
data class BudgetGoal(
    val id: String,
    val name: String,
    @SerialName("target_cents") val targetCents: Long,
    @SerialName("saved_cents") val savedCents: Long = 0,
    @SerialName("remaining_cents") val remainingCents: Long = 0,
    val percent: Int = 0,
    val complete: Boolean = false,
    @SerialName("account_id") val accountId: String? = null,
    val account: String? = null,
    @SerialName("target_date") val targetDate: String? = null,
    @SerialName("archived_at") val archivedAt: String? = null,
)

/**
 * A goal on its way to the server. Target and saved are major-unit text, like
 * transaction amounts, so no float ever carries money across the wire.
 */
@Serializable
data class BudgetGoalDraft(
    val name: String,
    val target: String,
    val saved: String? = null,
    @SerialName("account_id") val accountId: String? = null,
    @SerialName("target_date") val targetDate: String? = null,
    val archived: Boolean? = null,
)

/** A receipt's record. The image itself lives behind the authorized `url`. */
@Serializable
data class BudgetReceipt(
    val id: String,
    @SerialName("transaction_id") val transactionId: String,
    val mime: String = "",
    @SerialName("size_bytes") val sizeBytes: Long = 0,
    val url: String = "",
)

/** A transaction on its way to the server; [amount] stays major-unit text. */
data class BudgetTransactionDraft(
    val accountId: String,
    val type: String,
    val amount: String,
    val description: String? = null,
    /** `YYYY-MM-DD`; the server defaults to today. */
    val occurredOn: String? = null,
    val merchant: String? = null,
    val categoryId: String? = null,
)

@Serializable
data class BudgetCategoryTotal(
    @SerialName("category_id") val categoryId: String? = null,
    val name: String,
    val kind: String = "expense",
    @SerialName("spent_cents") val spentCents: Long = 0,
    @SerialName("income_cents") val incomeCents: Long = 0,
)

@Serializable
data class BudgetMonthTotal(
    val period: String,
    @SerialName("income_cents") val incomeCents: Long = 0,
    @SerialName("expense_cents") val expenseCents: Long = 0,
)

@Serializable
data class BudgetNetWorthPoint(
    val period: String,
    @SerialName("net_cents") val netCents: Long = 0,
)

/** Reply from `budget-reports`; the period the figures cover. */
@Serializable
data class BudgetReport(
    val period: String,
    val currency: String = "ZAR",
    val categories: List<BudgetCategoryTotal> = emptyList(),
    val monthly: List<BudgetMonthTotal> = emptyList(),
    @SerialName("net_worth") val netWorth: List<BudgetNetWorthPoint> = emptyList(),
    val limits: List<BudgetLimitState> = emptyList(),
)

@Serializable
data class BudgetBill(
    val id: String,
    val description: String? = null,
    val account: String? = null,
    @SerialName("amount_cents") val amountCents: Long = 0,
    @SerialName("next_run_at") val nextRunAt: String? = null,
    @SerialName("days_until_due") val daysUntilDue: Int? = null,
    @SerialName("remind_days_before") val remindDaysBefore: Int? = null,
)

/**
 * Reply from `budget-due`: bills inside their reminder window and caps that
 * are near or over. The server never notifies; the client raises its own.
 */
@Serializable
data class BudgetDue(
    val today: String = "",
    val bills: List<BudgetBill> = emptyList(),
    val limits: List<BudgetLimitState> = emptyList(),
) {
    val isEmpty: Boolean get() = bills.isEmpty() && limits.isEmpty()
}
