package com.jackandthings.pomodoro

import com.jackandthings.model.PomodoroPreset
import com.jackandthings.testing.FakePomodoroSessionRepository
import java.io.IOException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Turning a finished interval into a row on the server.
 *
 * The floor is the interesting rule: a phase change under five seconds was a
 * misclick, not a session, and logging those would bury the "started six,
 * finished four" signal the analytics exist to show. The same constant holds
 * on the web and in the add-on.
 */
class PomodoroSessionRecorderTest {

    private val preset = PomodoroPreset(
        id = "p1",
        name = "Classic 25/5",
        focusMinutes = 25,
        breakMinutes = 5,
        tag = "Coding",
    )

    private fun endedEvent(
        durationSeconds: Int,
        completed: Boolean = true,
        phase: TimerPhase = TimerPhase.Focus,
        activePreset: PomodoroPreset = preset,
    ): PomodoroEvent.IntervalEnded {
        val startedAt = 1_763_000_000_000L

        return PomodoroEvent.IntervalEnded(
            preset = activePreset,
            phase = phase,
            startedAtMillis = startedAt,
            endedAtMillis = startedAt + durationSeconds * 1_000L,
            completed = completed,
        )
    }

    @Test
    fun `a finished interval is recorded with everything the analytics need`() = runTest {
        val sessions = FakePomodoroSessionRepository()

        assertTrue(PomodoroSessionRecorder(sessions).record(endedEvent(1500)))

        val draft = sessions.created.single()
        assertEquals("p1", draft.presetId)
        assertEquals("Classic 25/5", draft.presetName)
        assertEquals("Coding", draft.tag)
        assertEquals("focus", draft.phase)
        assertEquals(1500, draft.durationSeconds)
        assertTrue(draft.completed)
        assertEquals("android", draft.source)
    }

    @Test
    fun `an abandoned interval is still recorded, as abandoned`() = runTest {
        val sessions = FakePomodoroSessionRepository()

        // "I skipped four of six today" is exactly what the analytics should
        // be able to show, so a cut-short run is kept rather than dropped.
        PomodoroSessionRecorder(sessions).record(endedEvent(600, completed = false))

        assertFalse(sessions.created.single().completed)
        assertEquals(600, sessions.created.single().durationSeconds)
    }

    @Test
    fun `a misclick under the floor is not recorded at all`() = runTest {
        val sessions = FakePomodoroSessionRepository()
        val recorder = PomodoroSessionRecorder(sessions)

        assertFalse(recorder.record(endedEvent(PomodoroSessionRecorder.MIN_LOGGED_SECONDS - 1)))
        assertFalse(recorder.record(endedEvent(0)))
        assertTrue(sessions.created.isEmpty())
    }

    @Test
    fun `an interval exactly on the floor is recorded`() = runTest {
        val sessions = FakePomodoroSessionRepository()

        assertTrue(
            PomodoroSessionRecorder(sessions)
                .record(endedEvent(PomodoroSessionRecorder.MIN_LOGGED_SECONDS)),
        )
    }

    @Test
    fun `both break phases are recorded under their own names`() = runTest {
        val sessions = FakePomodoroSessionRepository()
        val recorder = PomodoroSessionRecorder(sessions)

        recorder.record(endedEvent(300, phase = TimerPhase.ShortBreak))
        recorder.record(endedEvent(1200, phase = TimerPhase.LongBreak))

        assertEquals(listOf("short_break", "long_break"), sessions.created.map { it.phase })
    }

    @Test
    fun `a preset with no server id sends none rather than a blank one`() = runTest {
        val sessions = FakePomodoroSessionRepository()

        // The server scopes its exists rule to the caller, so a blank id
        // would be refused outright; the name still carries the label.
        PomodoroSessionRecorder(sessions).record(
            endedEvent(1500, activePreset = preset.copy(id = "")),
        )

        assertNull(sessions.created.single().presetId)
        assertEquals("Classic 25/5", sessions.created.single().presetName)
    }

    @Test
    fun `timestamps are sent as absolute instants`() = runTest {
        val sessions = FakePomodoroSessionRepository()

        PomodoroSessionRecorder(sessions).record(endedEvent(1500))

        // The server parses these, and a local time without an offset would
        // be read as UTC and file the session on the wrong day.
        val draft = sessions.created.single()
        assertTrue("startedAt was ${draft.startedAt}", draft.startedAt.endsWith("Z"))
        assertTrue("endedAt was ${draft.endedAt}", draft.endedAt.endsWith("Z"))
    }

    @Test
    fun `an unreachable server loses the row rather than taking the timer down`() = runTest {
        val sessions = FakePomodoroSessionRepository().apply {
            failure = IOException("offline")
        }

        // The user has no action to take about a lost analytics row, and a
        // retry loop on a timer callback would turn one unreachable server
        // into a flood.
        assertFalse(PomodoroSessionRecorder(sessions).record(endedEvent(1500)))
    }
}
