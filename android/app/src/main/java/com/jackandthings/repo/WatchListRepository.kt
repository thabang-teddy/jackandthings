package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.WatchList
import com.jackandthings.model.WatchListItem

interface WatchListRepository {
    suspend fun lists(): Result<List<WatchList>>

    suspend fun createList(name: String): Result<WatchList>

    suspend fun deleteList(id: String): Result<Unit>

    suspend fun addItem(watchListId: String, title: String, note: String?): Result<WatchListItem>

    suspend fun updateItem(id: String, done: Boolean): Result<WatchListItem>

    suspend fun deleteItem(id: String): Result<Unit>
}

class ApiWatchListRepository(private val api: JackApi) : WatchListRepository {

    override suspend fun lists(): Result<List<WatchList>> = apiCall { api.watchLists() }

    override suspend fun createList(name: String): Result<WatchList> =
        apiCall { api.createWatchList(name) }

    override suspend fun deleteList(id: String): Result<Unit> = apiCall { api.deleteWatchList(id) }

    override suspend fun addItem(
        watchListId: String,
        title: String,
        note: String?,
    ): Result<WatchListItem> = apiCall { api.createWatchListItem(watchListId, title, note) }

    override suspend fun updateItem(id: String, done: Boolean): Result<WatchListItem> =
        apiCall { api.updateWatchListItem(id, done) }

    override suspend fun deleteItem(id: String): Result<Unit> = apiCall { api.deleteWatchListItem(id) }
}
