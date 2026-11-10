package com.jackandthings.ui.watchlist

import com.jackandthings.model.WatchList
import com.jackandthings.model.WatchListItem
import com.jackandthings.testing.FakeWatchListRepository
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WatchListViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val existing = WatchList(
        id = "list-1",
        name = "May watch list",
        items = listOf(WatchListItem("item-1", "list-1", "Dune: Part Two")),
    )

    @Test
    fun `lists load on creation`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val model = WatchListViewModel(FakeWatchListRepository(mutableListOf(existing)))

        advanceUntilIdle()

        assertEquals(listOf(existing), model.state.value.lists)
        assertFalse(model.state.value.loading)
    }

    @Test
    fun `creating a list reloads`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakeWatchListRepository()
        val model = WatchListViewModel(repo)
        advanceUntilIdle()

        model.createList("  To read  ")
        advanceUntilIdle()

        // Trimmed before it reaches the repository.
        assertEquals(listOf("To read"), repo.createdLists)
        assertEquals(listOf("To read"), model.state.value.lists.map { it.name })
    }

    @Test
    fun `a blank list name is not created`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakeWatchListRepository()
        val model = WatchListViewModel(repo)
        advanceUntilIdle()

        model.createList("   ")
        advanceUntilIdle()

        assertEquals(emptyList<String>(), repo.createdLists)
    }

    @Test
    fun `adding an item targets its list`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakeWatchListRepository(mutableListOf(existing))
        val model = WatchListViewModel(repo)
        advanceUntilIdle()

        model.addItem("list-1", "The Bear")
        advanceUntilIdle()

        assertEquals(Triple("list-1", "The Bear", null), repo.addedItems.single())
    }

    @Test
    fun `toggling an item flips its done flag`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeWatchListRepository(mutableListOf(existing))
            val model = WatchListViewModel(repo)
            advanceUntilIdle()

            model.toggleItem(existing.items.first())
            advanceUntilIdle()

            assertEquals("item-1" to true, repo.toggledIds.single())
        }

    @Test
    fun `deleting a list removes it and reloads`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeWatchListRepository(mutableListOf(existing))
            val model = WatchListViewModel(repo)
            advanceUntilIdle()

            model.deleteList("list-1")
            advanceUntilIdle()

            assertEquals(listOf("list-1"), repo.deletedIds)
            assertEquals(emptyList<WatchList>(), model.state.value.lists)
        }

    @Test
    fun `a failed load surfaces the reason`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeWatchListRepository()
            repo.failure = RuntimeException("offline")
            val model = WatchListViewModel(repo)

            advanceUntilIdle()

            assertNotNull(model.state.value.error)
            assertFalse(model.state.value.loading)
        }
}
