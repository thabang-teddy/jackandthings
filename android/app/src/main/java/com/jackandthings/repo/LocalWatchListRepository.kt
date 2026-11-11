package com.jackandthings.repo

import com.jackandthings.data.local.JsonFileStore
import com.jackandthings.model.WatchList
import com.jackandthings.model.WatchListItem
import java.util.UUID

/** Backs the Watch list module while there is no signed-in session to save to. */
class LocalWatchListRepository(private val store: JsonFileStore<WatchList>) : WatchListRepository {

    override suspend fun lists(): Result<List<WatchList>> = Result.success(store.read())

    override suspend fun createList(name: String): Result<WatchList> {
        val list = WatchList(id = UUID.randomUUID().toString(), name = name)
        store.write(store.read() + list)
        return Result.success(list)
    }

    override suspend fun deleteList(id: String): Result<Unit> {
        store.write(store.read().filterNot { it.id == id })
        return Result.success(Unit)
    }

    override suspend fun addItem(
        watchListId: String,
        title: String,
        note: String?,
    ): Result<WatchListItem> {
        val lists = store.read()
        if (lists.none { it.id == watchListId }) {
            return Result.failure(IllegalArgumentException("List not found"))
        }

        val item = WatchListItem(
            id = UUID.randomUUID().toString(),
            watchListId = watchListId,
            title = title,
            note = note,
        )
        store.write(lists.map { if (it.id == watchListId) it.copy(items = it.items + item) else it })
        return Result.success(item)
    }

    override suspend fun updateItem(id: String, done: Boolean): Result<WatchListItem> {
        var updated: WatchListItem? = null
        val lists = store.read().map { list ->
            if (list.items.none { it.id == id }) {
                list
            } else {
                list.copy(
                    items = list.items.map { item ->
                        if (item.id == id) item.copy(done = done).also { updated = it } else item
                    },
                )
            }
        }
        store.write(lists)
        return updated?.let { Result.success(it) }
            ?: Result.failure(IllegalArgumentException("Item not found"))
    }

    override suspend fun deleteItem(id: String): Result<Unit> {
        store.write(store.read().map { it.copy(items = it.items.filterNot { item -> item.id == id }) })
        return Result.success(Unit)
    }
}
