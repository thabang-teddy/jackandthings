package com.jackandthings.ui.notes

import com.jackandthings.model.Note
import com.jackandthings.testing.FakeNotesRepository
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
class NotesViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val existing = Note("note-1", "Shopping", "Milk")

    @Test
    fun `notes load on creation`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val model = NotesViewModel(FakeNotesRepository(mutableListOf(existing)))

        advanceUntilIdle()

        assertEquals(listOf(existing), model.state.value.notes)
        assertFalse(model.state.value.loading)
    }

    @Test
    fun `a failed load surfaces the reason`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakeNotesRepository().apply { failure = RuntimeException("offline") }
        val model = NotesViewModel(repo)

        advanceUntilIdle()

        assertEquals("offline", model.state.value.error)
        assertFalse(model.state.value.loading)
    }

    @Test
    fun `starting a new note opens an empty editor`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = NotesViewModel(FakeNotesRepository())
            advanceUntilIdle()

            model.startNew()

            // A blank id is what marks it as unsaved.
            assertEquals("", model.state.value.editing?.id)
            assertEquals("", model.state.value.editing?.title)
        }

    @Test
    fun `saving a new note creates rather than updates`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeNotesRepository()
            val model = NotesViewModel(repo)
            advanceUntilIdle()
            model.startNew()

            model.save("Groceries", "Bread")
            advanceUntilIdle()

            assertEquals(listOf("Groceries" to "Bread"), repo.created)
            assertEquals(emptyList<Triple<String, String, String?>>(), repo.updated)
            assertNull(model.state.value.editing)
        }

    @Test
    fun `saving an existing note updates rather than creates`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeNotesRepository(mutableListOf(existing))
            val model = NotesViewModel(repo)
            advanceUntilIdle()
            model.startEdit(existing)

            model.save("Shopping list", "Milk, bread")
            advanceUntilIdle()

            assertEquals(
                listOf(Triple("note-1", "Shopping list", "Milk, bread")),
                repo.updated,
            )
            assertEquals(emptyList<Pair<String, String?>>(), repo.created)
        }

    @Test
    fun `the title is trimmed before saving`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeNotesRepository()
            val model = NotesViewModel(repo)
            advanceUntilIdle()
            model.startNew()

            model.save("  Padded  ", "body")
            advanceUntilIdle()

            assertEquals("Padded", repo.created.single().first)
        }

    @Test
    fun `a blank title is not saved`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakeNotesRepository()
        val model = NotesViewModel(repo)
        advanceUntilIdle()
        model.startNew()

        model.save("   ", "body")
        advanceUntilIdle()

        assertEquals(emptyList<Pair<String, String?>>(), repo.created)
        // The editor stays open so the title can be filled in.
        assertNotNull(model.state.value.editing)
    }

    @Test
    fun `a rejected save keeps the editor open with the reason`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeNotesRepository()
            val model = NotesViewModel(repo)
            advanceUntilIdle()
            model.startNew()
            repo.failure = RuntimeException("The title field is required.")

            model.save("Something", "body")
            advanceUntilIdle()

            assertNotNull(model.state.value.editing)
            assertEquals("The title field is required.", model.state.value.error)
            assertFalse(model.state.value.saving)
        }

    @Test
    fun `cancelling closes the editor without writing`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeNotesRepository()
            val model = NotesViewModel(repo)
            advanceUntilIdle()
            model.startNew()

            model.cancelEdit()

            assertNull(model.state.value.editing)
            assertEquals(emptyList<Pair<String, String?>>(), repo.created)
        }

    @Test
    fun `deleting removes the note and reloads`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeNotesRepository(mutableListOf(existing))
            val model = NotesViewModel(repo)
            advanceUntilIdle()

            model.delete(existing.id)
            advanceUntilIdle()

            assertEquals(listOf("note-1"), repo.deletedIds)
            assertEquals(emptyList<Note>(), model.state.value.notes)
        }
}
