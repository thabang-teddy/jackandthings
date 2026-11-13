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
