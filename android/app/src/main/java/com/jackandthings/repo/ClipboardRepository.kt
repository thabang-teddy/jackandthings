package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.ClipboardItem

interface ClipboardRepository {
    suspend fun list(): Result<List<ClipboardItem>>

    /**
     * [sourceDevice] is what makes a snippet legible once several clients are
     * saving to the same account, so this app always stamps it.
     */
    suspend fun create(title: String?, content: String, sourceDevice: String?): Result<ClipboardItem>

    suspend fun delete(id: String): Result<Unit>
}

class ApiClipboardRepository(private val api: JackApi) : ClipboardRepository {

    override suspend fun list(): Result<List<ClipboardItem>> = apiCall { api.clipboardItems() }

    override suspend fun create(
        title: String?,
        content: String,
        sourceDevice: String?,
    ): Result<ClipboardItem> = apiCall { api.createClipboardItem(title, content, sourceDevice) }

    override suspend fun delete(id: String): Result<Unit> = apiCall { api.deleteClipboardItem(id) }
}
