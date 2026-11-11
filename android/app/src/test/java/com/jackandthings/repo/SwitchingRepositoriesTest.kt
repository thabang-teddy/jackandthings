package com.jackandthings.repo

import com.jackandthings.model.Note
import com.jackandthings.testing.FakeAuthStore
import com.jackandthings.testing.FakeNotesRepository
import com.jackandthings.testing.FakeWorkoutRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Which side of the app a call lands on. The switch is read per call rather
 * than once, so signing in mid-session redirects the next call without the
 * screen being rebuilt.
 */
class SwitchingRepositoriesTest {

    private val auth = FakeAuthStore()
    private val local = FakeNotesRepository(mutableListOf(Note("local-1", "On device", null)))
    private val remote = FakeNotesRepository(mutableListOf(Note("remote-1", "On server", null)))
    private val repo = SwitchingNotesRepository(auth, local, remote)

    @Test
    fun `signed out reads come off the device`() = runTest {
        assertEquals(listOf("On device"), repo.list().getOrThrow().map { it.title })
    }

    @Test
    fun `signed in reads come off the server`() = runTest {
        auth.signIn("someone@example.com", "secret")

        assertEquals(listOf("On server"), repo.list().getOrThrow().map { it.title })
    }

    @Test
    fun `writes follow the session, and signing in redirects the next one`() = runTest {
        repo.create("Written offline", null)
        assertEquals(listOf("Written offline" to null), local.created)
        assertTrue(remote.created.isEmpty())

        auth.signIn("someone@example.com", "secret")
        repo.create("Written online", null)

        assertEquals(listOf("Written online" to null), remote.created)
        assertEquals(1, local.created.size)
    }

    @Test
    fun `signing out sends the next call back to the device`() = runTest {
        auth.signIn("someone@example.com", "secret")
        repo.create("Written online", null)

        auth.signOut()
        repo.create("Back offline", null)

        assertEquals(listOf("Back offline" to null), local.created)
    }

    @Test
    fun `the workout switch covers presets too`() = runTest {
        val localWorkout = FakeWorkoutRepository()
        val remoteWorkout = FakeWorkoutRepository(
            presets = mutableListOf(
                com.jackandthings.model.WorkoutPreset("wp-1", "Push day", "Push-ups"),
            ),
        )
        val workout = SwitchingWorkoutRepository(auth, localWorkout, remoteWorkout)

        assertTrue(workout.presets().getOrThrow().isEmpty())

        auth.signIn("someone@example.com", "secret")

        assertEquals(listOf("Push day"), workout.presets().getOrThrow().map { it.name })
    }
}
