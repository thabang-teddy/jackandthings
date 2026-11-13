package com.jackandthings.pomodoro

import com.jackandthings.model.PomodoroSessionDraft
import com.jackandthings.repo.PomodoroSessionRepository
import java.time.Instant
import java.time.format.DateTimeFormatter

/**
 * Turns [PomodoroEvent.IntervalEnded] into a row on the server.
 *
 * Separate from the engine so the engine stays Context-free and free of the
 * network, and separate from the ViewModel so an interval that ends while no
 * Pomodoro screen is open is still recorded - which is the normal case, since
 * the timer runs behind a foreground service.
 *
 * A failed post is dropped rather than retried here: the offline decorator
 * underneath already queues what it can, the user has no action to take about
 * a lost analytics row, and a retry loop on a timer callback is a good way to
 * turn one unreachable server into a flood.
 */
class PomodoroSessionRecorder(
    private val sessions: PomodoroSessionRepository,
) {

    suspend fun record(event: PomodoroEvent.IntervalEnded): Boolean {
        val durationSeconds = ((event.endedAtMillis - event.startedAtMillis) / 1000).toInt()

        if (durationSeconds < MIN_LOGGED_SECONDS) return false

        return sessions.create(
            PomodoroSessionDraft(
                // A preset created offline has a local id the server has
                // never seen, and the scoped exists rule would reject it.
                // The name always carries the label either way.
                presetId = event.preset.id.takeIf { it.isNotBlank() },
                presetName = event.preset.name,
                tag = event.preset.tag,
                phase = event.phase.wireValue,
                startedAt = iso(event.startedAtMillis),
                endedAt = iso(event.endedAtMillis),
                durationSeconds = durationSeconds,
                completed = event.completed,
            ),
        ).isSuccess
    }

    private fun iso(millis: Long): String =
        DateTimeFormatter.ISO_INSTANT.format(Instant.ofEpochMilli(millis))

    companion object {
        /**
         * Below this, a phase change was a misclick rather than a session.
         * Matches MIN_LOGGED_SECONDS in Lib/pomodoroSessionLog.js, so the
         * three surfaces agree about what is worth recording.
         */
        const val MIN_LOGGED_SECONDS = 5
    }
}
