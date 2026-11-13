package com.jackandthings.pomodoro

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.provider.Settings

/**
 * Strict mode on Android: silences notifications for the length of a focus
 * run, and puts them back afterwards.
 *
 * This is the surface where the issue's "blocks distracting notifications"
 * can actually be honoured, and it is still conditional. Changing the
 * interruption filter needs ACCESS_NOTIFICATION_POLICY, which is not a
 * runtime permission - the user grants it in a Settings screen, and no app
 * can prompt for it inline. So:
 *
 *   - [canSilence] says whether it has been granted;
 *   - [settingsIntent] is where to send the user to grant it;
 *   - [engage] is a no-op without it, and the screen says so rather than
 *     implying notifications were blocked when they were not.
 *
 * The previous filter is captured on the way in and restored on the way out,
 * so a user who already lives in Do Not Disturb is not dropped back into
 * ringing because a Pomodoro ended.
 */
class FocusGuard(context: Context) {

    private val appContext = context.applicationContext

    private val notifications: NotificationManager? =
        appContext.getSystemService(NotificationManager::class.java)

    /** The filter in force before we changed it; null when we have not. */
    private var restoreFilter: Int? = null

    fun canSilence(): Boolean = notifications?.isNotificationPolicyAccessGranted == true

    /** Where to send the user to grant the policy access this needs. */
    fun settingsIntent(): Intent =
        Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    /**
     * Silences notifications, if allowed. Returns whether it actually took
     * effect, so a caller can tell the user the truth either way.
     */
    fun engage(): Boolean {
        val manager = notifications ?: return false
        if (!canSilence() || restoreFilter != null) return restoreFilter != null

        return runCatching {
            restoreFilter = manager.currentInterruptionFilter
            // PRIORITY rather than NONE: alarms and the user's own starred
            // contacts still get through. A focus timer should not be able to
            // make somebody miss a genuine emergency.
            manager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
            true
        }.getOrElse {
            restoreFilter = null
            false
        }
    }

    /** Puts the user's own interruption filter back. Safe to call unengaged. */
    fun release() {
        val manager = notifications ?: return
        val previous = restoreFilter ?: return
        restoreFilter = null

        runCatching { manager.setInterruptionFilter(previous) }
    }

    val engaged: Boolean get() = restoreFilter != null
}
