package com.jackandthings.work

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.jackandthings.JackApplication
import java.util.concurrent.TimeUnit

/**
 * Empties the outbox — the writes made while signed in but unable to reach
 * the server — once there is a connection again.
 *
 * WorkManager rather than a connectivity listener in the app: the queue has
 * to survive the app being closed, and the platform already knows when the
 * network comes back. Same approach as [WorkoutReminders], which is the
 * other thing here that waits on a network.
 */
object OutboxSync {

    private const val PERIODIC_WORK = "outbox-sync-periodic"
    private const val NOW_WORK = "outbox-sync-now"

    private val whenConnected = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    /**
     * The safety net: fifteen minutes is WorkManager's floor for periodic
     * work, and a queue that is already empty costs one cheap read.
     */
    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<OutboxSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(whenConnected)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PERIODIC_WORK,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    /**
     * Drains as soon as there is a connection, for the cases worth not
     * waiting a quarter of an hour for: the app opening, and a write that
     * just went into the queue.
     */
    fun syncNow(context: Context) {
        val request = OneTimeWorkRequestBuilder<OutboxSyncWorker>()
            .setConstraints(whenConnected)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            NOW_WORK,
            // A drain already waiting to run covers anything queued since,
            // because it reads the whole outbox when it starts.
            ExistingWorkPolicy.KEEP,
            request,
        )
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_WORK)
        WorkManager.getInstance(context).cancelUniqueWork(NOW_WORK)
    }
}

class OutboxSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as? JackApplication ?: return Result.success()
        val container = app.container

        // Nothing in the queue belongs to a signed-out session, and replaying
        // it without a token would only burn retries against a 401.
        if (!container.auth.signedIn.value) return Result.success()

        val drained = container.outboxDrainer.drain()

        // Anything left is waiting on a server that still is not answering,
        // so back off and come back rather than reporting done.
        return if (drained.stillPending > 0) Result.retry() else Result.success()
    }
}
