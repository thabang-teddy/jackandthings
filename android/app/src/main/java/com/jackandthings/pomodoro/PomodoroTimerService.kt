package com.jackandthings.pomodoro

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
 * Keeps the running Pomodoro visible and controllable from the notification
 * shade - restart, pause/resume, skip, and stop - while the app is
 * backgrounded. [PomodoroTimerEngine] owns the actual countdown; this
 * service only renders it and relays the action taps back into it, so it
 * has nothing of its own to get out of sync.
 */
class PomodoroTimerService : Service() {

    private val scope = CoroutineScope(SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        createChannel()

        PomodoroTimerEngine.state
            .onEach { timer ->
                if (timer.activePreset == null) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                } else {
                    startForeground(NOTIFICATION_ID, buildNotification(timer))
                }
            }
            .launchIn(scope)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PAUSE -> PomodoroTimerEngine.pause()
            ACTION_RESUME -> PomodoroTimerEngine.resume()
            ACTION_SKIP -> PomodoroTimerEngine.skip()
            ACTION_STOP -> PomodoroTimerEngine.stop()
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
            getString(R.string.pomodoro_timer_channel_name),
            // Low: the clock updates once a second and should never buzz or pop.
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = getString(R.string.pomodoro_timer_channel_description)
        }

        getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }

    private fun buildNotification(timer: PomodoroTimerState): Notification {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val phaseLabel = if (timer.phase == TimerPhase.Focus) "Focus" else "Break"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("$phaseLabel · ${timer.activePreset?.name.orEmpty()}")
            .setContentText(timer.clock)
            .setContentIntent(open)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            // The standard notification template shows at most 3 action
            // buttons (Notification.MAX_ACTION_BUTTONS); a 4th is silently
            // dropped by the system rather than shown anywhere else, so
            // Restart - the one most easily reached from inside the app
            // anyway - stays off the notification.
            .addAction(
                if (timer.running) action(ACTION_PAUSE, "Pause") else action(ACTION_RESUME, "Resume"),
            )
            .addAction(action(ACTION_SKIP, "Skip"))
            .addAction(action(ACTION_STOP, "Stop"))
            .build()
    }

    private fun action(actionName: String, title: String): NotificationCompat.Action {
        val intent = Intent(this, PomodoroTimerService::class.java).setAction(actionName)
        val pending = PendingIntent.getService(
            this,
            actionName.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Action.Builder(0, title, pending).build()
    }

    companion object {
        private const val CHANNEL_ID = "pomodoro_timer"
        private const val NOTIFICATION_ID = 2001

        private const val ACTION_PAUSE = "com.jackandthings.pomodoro.PAUSE"
        private const val ACTION_RESUME = "com.jackandthings.pomodoro.RESUME"
        private const val ACTION_SKIP = "com.jackandthings.pomodoro.SKIP"
        private const val ACTION_STOP = "com.jackandthings.pomodoro.STOP"

        fun start(context: Context) {
            context.startForegroundService(Intent(context, PomodoroTimerService::class.java))
        }
    }
}
