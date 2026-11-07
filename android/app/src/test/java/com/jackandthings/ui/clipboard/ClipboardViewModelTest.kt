package com.jackandthings.ui.clipboard

import com.jackandthings.model.ClipboardItem
import com.jackandthings.testing.FakeClipboardRepository
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ClipboardViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val existing = ClipboardItem("clip-1", "Server", "192.168.0.42")

    @Test
    fun `snippets load on creation`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val model = ClipboardViewModel(FakeClipboardRepository(mutableListOf(existing)))

        advanceUntilIdle()

        assertEquals(listOf(existing), model.state.value.items)
        assertFalse(model.state.value.loading)
    }

    @Test
    fun `the composer opens empty by default`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = ClipboardViewModel(FakeClipboardRepository())
            advanceUntilIdle()

            model.startNew()

            assertEquals("", model.state.value.draft)
        }

    @Test
    fun `the composer can be pre-filled from the clipboard`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = ClipboardViewModel(FakeClipboardRepository())
            advanceUntilIdle()

            model.startNew("pasted text")

            assertEquals("pasted text", model.state.value.draft)
        }

    @Test
    fun `saving stamps the device so snippets are legible across clients`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeClipboardRepository()
            val model = ClipboardViewModel(repo)
            advanceUntilIdle()
            model.startNew()

            model.save("Note", "copy me")
            advanceUntilIdle()

            val (title, content, device) = repo.created.single()
            assertEquals("Note", title)
            assertEquals("copy me", content)
            assertNotNull("a source device should always be recorded", device)
        }

    @Test
    fun `a blank title is sent as null rather than an empty string`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeClipboardRepository()
            val model = ClipboardViewModel(repo)
            advanceUntilIdle()
            model.startNew()

            model.save("   ", "copy me")
            advanceUntilIdle()

            assertNull(repo.created.single().first)
        }

    @Test
    fun `an empty snippet is not saved`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakeClipboardRepository()
        val model = ClipboardViewModel(repo)
        advanceUntilIdle()
        model.startNew()

        model.save("Title", "   ")
        advanceUntilIdle()

        assertEquals(emptyList<Triple<String?, String, String?>>(), repo.created)
        assertNotNull(model.state.value.draft)
    }

    @Test
    fun `content is kept verbatim, including whitespace that matters`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeClipboardRepository()
            val model = ClipboardViewModel(repo)
            advanceUntilIdle()
            model.startNew()

            // Snippets are often code or keys; trimming them would corrupt them.
            model.save("", "  indented\n  line  ")
            advanceUntilIdle()

            assertEquals("  indented\n  line  ", repo.created.single().second)
        }

    @Test
    fun `a rejected save keeps the composer open with the reason`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeClipboardRepository()
            val model = ClipboardViewModel(repo)
            advanceUntilIdle()
            model.startNew()
            repo.failure = RuntimeException("content is too long")

            model.save("", "x")
            advanceUntilIdle()

            assertNotNull(model.state.value.draft)
            assertEquals("content is too long", model.state.value.error)
            assertFalse(model.state.value.saving)
        }

    @Test
    fun `cancelling closes the composer`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val model = ClipboardViewModel(FakeClipboardRepository())
        advanceUntilIdle()
        model.startNew("something")

        model.cancel()

        assertNull(model.state.value.draft)
    }

    @Test
    fun `deleting removes the snippet and reloads`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeClipboardRepository(mutableListOf(existing))
            val model = ClipboardViewModel(repo)
            advanceUntilIdle()

            model.delete(existing.id)
            advanceUntilIdle()

            assertEquals(listOf("clip-1"), repo.deletedIds)
            assertEquals(emptyList<ClipboardItem>(), model.state.value.items)
        }
}
