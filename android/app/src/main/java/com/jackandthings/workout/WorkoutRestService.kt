package com.jackandthings.workout

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.jackandthings.MainActivity
import com.jackandthings.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

/**
 * Keeps a running rest countdown visible and skippable from the notification
 * shade while the app is backgrounded - which is most of a rest, since the
 * point of one is to put the phone down.
 *
 * [WorkoutRestTimer] owns the countdown; this service only renders it and
 * relays the two action taps back into it, so it has nothing of its own to get
 * out of sync. Same split as PomodoroTimerService, which it is modelled on.
 */
class WorkoutRestService : Service() {

    private val scope = CoroutineScope(SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        createChannel()

        WorkoutRestTimer.state
            .onEach { rest ->
                if (!rest.running) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                } else {
                    startForeground(NOTIFICATION_ID, buildNotification(rest))
                }
            }
            .launchIn(scope)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_EXTEND -> WorkoutRestTimer.extend(EXTEND_SECONDS)
            ACTION_SKIP -> WorkoutRestTimer.stop()
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.workout_rest_channel_name),
            // Low: the clock updates once a second and must never buzz. The
            // chime at the end is played by JackApplication, not by this.
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = getString(R.string.workout_rest_channel_description)
        }

        getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }

    private fun buildNotification(rest: RestTimerState): Notification {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Resting")
            .setContentText(
                rest.label?.let { "${rest.clock} · next: $it" } ?: rest.clock,
            )
            .setContentIntent(open)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(action(ACTION_EXTEND, "+30s"))
            .addAction(action(ACTION_SKIP, "Skip"))
            .build()
    }

    private fun action(actionName: String, title: String): NotificationCompat.Action {
        val intent = Intent(this, WorkoutRestService::class.java).setAction(actionName)
        val pending = PendingIntent.getService(
            this,
            actionName.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Action.Builder(0, title, pending).build()
    }

    companion object {
        private const val CHANNEL_ID = "workout_rest"

        /** Distinct from the Pomodoro timer's, so the two can both be up. */
        private const val NOTIFICATION_ID = 2002

        private const val EXTEND_SECONDS = 30

        private const val ACTION_EXTEND = "com.jackandthings.workout.EXTEND_REST"
        private const val ACTION_SKIP = "com.jackandthings.workout.SKIP_REST"

        fun start(context: Context) {
            context.startForegroundService(Intent(context, WorkoutRestService::class.java))
        }
    }
}
