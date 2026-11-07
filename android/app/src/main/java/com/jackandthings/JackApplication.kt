package com.jackandthings

import android.app.Application
import com.jackandthings.work.WorkoutReminders

class JackApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)

        WorkoutReminders.createChannel(this)

        // Re-arms on every launch so the schedule survives a reboot or an
        // install upgrade. KEEP means an already-queued run is left alone.
        if (container.prefs.remindersEnabled.value && container.auth.signedIn.value) {
            WorkoutReminders.schedule(this)
        }
    }
}
