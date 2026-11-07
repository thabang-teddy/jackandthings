package com.jackandthings.work

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.jackandthings.JackApplication
import com.jackandthings.MainActivity
import com.jackandthings.R
import java.util.concurrent.TimeUnit

/**
 * The hourly workout nudge.
 *
 * The server deliberately sends nothing (see docs/PRD.md): it only exposes
 * whether a workout has been logged this hour, and each client decides for
 * itself whether to raise a notification. This is that decision for Android.
 */
object WorkoutReminders {

    private const val CHANNEL_ID = "workout_reminders"
    private const val WORK_NAME = "workout-reminder-hourly"
    private const val NOTIFICATION_ID = 1001

    fun createChannel(context: Context) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.workout_reminder_channel_name),
            // Low: a missed hour is a nudge, not an emergency, so it should not
            // buzz or interrupt what the user is doing.
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = context.getString(R.string.workout_reminder_channel_description)
        }

        val manager = context.getSystemService(NotificationManager::class.java)
        manager?.createNotificationChannel(channel)
    }

    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<WorkoutReminderWorker>(1, TimeUnit.HOURS)
            .setConstraints(
                // Without a network the due-check cannot be answered, so there
                // is no point waking up to fail.
                Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
            )
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }

    internal fun notifyDue(context: Context) {
        // Checked rather than assumed: the user can refuse the permission on
        // API 33+, or mute the channel afterwards.
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return

        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("No workout logged this hour")
            .setContentText("Tap to log what you have done.")
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
    }
}

class WorkoutReminderWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as? JackApplication ?: return Result.success()
        val container = app.container

        if (!container.prefs.remindersEnabled.value) return Result.success()
        if (!container.auth.signedIn.value) return Result.success()

        return container.workout.reminderState().fold(
            onSuccess = { state ->
                if (state.due) WorkoutReminders.notifyDue(applicationContext)
                Result.success()
            },
            // Retry rather than fail: a flaky moment should not cost the whole
            // hour's nudge, and WorkManager backs off on its own.
            onFailure = { Result.retry() },
        )
    }
}
