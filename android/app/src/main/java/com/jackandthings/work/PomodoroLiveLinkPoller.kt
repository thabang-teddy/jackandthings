package com.jackandthings.work

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.jackandthings.JackApplication
import com.jackandthings.model.PomodoroLiveLinkState
import com.jackandthings.pomodoro.PomodoroTimerEngine
import java.util.concurrent.TimeUnit

/**
 * The phone checks for a live link every five minutes: has the website (or
 * another device) started a Pomodoro that this phone should show? Once a live
 * link exists, the poller stops - the live link keeps the two surfaces in sync
 * from then on, so there is nothing to poll for.
 */
object PomodoroLiveLinkPoller {

    private const val WORK_NAME = "pomodoro-live-link-poll"
    private const val POLL_MINUTES = 5L

    fun schedule(context: Context) {
        val request = OneTimeWorkRequestBuilder<PomodoroLiveLinkPollerWorker>()
            .setInitialDelay(POLL_MINUTES, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
            )
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            WORK_NAME,
            ExistingWorkPolicy.KEEP,
            request,
        )
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }
}

class PomodoroLiveLinkPollerWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as? JackApplication ?: return Result.success()
        val container = app.container

        if (!container.auth.signedIn.value) return Result.success()

        return container.pomodoroLiveLink.get().fold(
            onSuccess = { state ->
                if (state != null && state.running) {
                    // Adopt a remote timer if this phone is idle. Starting from
                    // the top of the focus phase is the same adoption the web
                    // does - the exact seconds left and phase are not carried
                    // over, but the same clock is running on both surfaces.
                    val current = PomodoroTimerEngine.state.value
                    if (current.activePreset == null) {
                        state.activePreset?.let { PomodoroTimerEngine.start(it) }
                    }
                    // A live link means the timer is being synced server-side,
                    // so stop polling for changes.
                    PomodoroLiveLinkPoller.cancel(applicationContext)
                    Result.success()
                } else {
                    // No live link yet: check again in five minutes.
                    PomodoroLiveLinkPoller.schedule(applicationContext)
                    Result.success()
                }
            },
            onFailure = { Result.retry() },
        )
    }
}


