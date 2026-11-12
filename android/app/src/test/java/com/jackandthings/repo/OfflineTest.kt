package com.jackandthings.repo

import com.jackandthings.data.local.JsonFileStore
import com.jackandthings.data.remote.ApiException
import com.jackandthings.model.Note
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * The two primitives the whole offline layer rests on.
 *
 * [isOffline] is the one that would be easy to get wrong and expensive to
 * get wrong: ApiException extends IOException, so a naive `is IOException`
 * would treat every rejected form as a dropped connection and queue it to
 * be refused again forever.
 */
class OfflineTest {

    @get:Rule
    val folder = TemporaryFolder()

    private fun cache() = JsonFileStore(folder.newFile(), Note.serializer())

    // ── isOffline ──────────────────────────────────────────────────────────

    @Test
    fun `a dropped connection counts as offline`() {
        assertTrue(IOException("socket closed").isOffline)
        assertTrue(UnknownHostException("jackandthings.test").isOffline)
        assertTrue(SocketTimeoutException("timeout").isOffline)
    }

    @Test
    fun `a reply from the server does not count as offline`() {
        assertFalse(ApiException(422, "The activity field is required.").isOffline)
        assertFalse(ApiException(404, "Not found").isOffline)
        assertFalse(ApiException(500, "Server Error").isOffline)
    }

    @Test
    fun `an unauthenticated reply does not count as offline`() {
        // A 401 drops the user to sign-in; queueing the write would hide that.
        assertFalse(ApiException(401, "Unauthenticated.").isOffline)
    }

    @Test
    fun `an ordinary bug does not count as offline`() {
        assertFalse(IllegalStateException("boom").isOffline)
    }

    // ── readThroughCache ───────────────────────────────────────────────────

    @Test
    fun `a successful read is returned and remembered`() = runTest {
        val cache = cache()
        val fresh = listOf(Note(id = "1", title = "From the server"))

        val result = readThroughCache(cache) { Result.success(fresh) }

        assertEquals(fresh, result.getOrThrow())
        assertEquals(fresh, cache.read())
    }

    @Test
    fun `an unreachable server is answered from the last read`() = runTest {
        val cache = cache()
        val seen = listOf(Note(id = "1", title = "Seen earlier"))
        readThroughCache(cache) { Result.success(seen) }

        val result = readThroughCache<Note>(cache) { Result.failure(IOException()) }

        assertTrue(result.isSuccess)
        assertEquals(seen, result.getOrThrow())
    }

    @Test
    fun `an unreachable server with nothing cached yet gives an empty list`() = runTest {
        val result = readThroughCache<Note>(cache()) { Result.failure(IOException()) }

        assertEquals(emptyList<Note>(), result.getOrThrow())
    }

    @Test
    fun `a refusal from the server is not hidden behind stale rows`() = runTest {
        val cache = cache()
        readThroughCache(cache) { Result.success(listOf(Note(id = "1", title = "Seen earlier"))) }

        val refused = ApiException(401, "Unauthenticated.")
        val result = readThroughCache<Note>(cache) { Result.failure(refused) }

        assertTrue(result.isFailure)
        assertEquals(refused, result.exceptionOrNull())
    }

    @Test
    fun `a failed read leaves the cache as it was`() = runTest {
        val cache = cache()
        val seen = listOf(Note(id = "1", title = "Seen earlier"))
        readThroughCache(cache) { Result.success(seen) }

        readThroughCache<Note>(cache) { Result.failure(IOException()) }

        assertEquals(seen, cache.read())
    }

    // ── orWhenOffline ──────────────────────────────────────────────────────

    @Test
    fun `a successful write never reaches the fallback`() = runTest {
        var fellBack = false

        val result = orWhenOffline(Result.success("sent")) {
            fellBack = true
            Result.success("queued")
        }

        assertEquals("sent", result.getOrThrow())
        assertFalse(fellBack)
    }

    @Test
    fun `an unreachable server falls back`() = runTest {
        val result = orWhenOffline(Result.failure<String>(IOException())) {
            Result.success("queued")
        }

        assertEquals("queued", result.getOrThrow())
    }

    @Test
    fun `a refused write is handed back as the refusal it was`() = runTest {
        val refused = ApiException(422, "The title field is required.")
        var fellBack = false

        val result = orWhenOffline(Result.failure<String>(refused)) {
            fellBack = true
            Result.success("queued")
        }

        assertTrue(result.isFailure)
        assertEquals(refused, result.exceptionOrNull())
        assertFalse(fellBack)
    }
}
