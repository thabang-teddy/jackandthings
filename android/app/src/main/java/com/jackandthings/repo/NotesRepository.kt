package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.Note

/**
 * Each module's repository is an interface so a ViewModel can be tested
 * against a fake rather than a live server. The API-backed implementation is
 * the only one in the app; the fakes live in the test source set.
 */
interface NotesRepository {
    suspend fun list(): Result<List<Note>>

    suspend fun create(title: String, body: String?): Result<Note>

    suspend fun update(id: String, title: String, body: String?): Result<Note>

    suspend fun delete(id: String): Result<Unit>
}

class ApiNotesRepository(private val api: JackApi) : NotesRepository {

    override suspend fun list(): Result<List<Note>> = apiCall { api.notes() }

    override suspend fun create(title: String, body: String?): Result<Note> =
        apiCall { api.createNote(title, body) }

    override suspend fun update(id: String, title: String, body: String?): Result<Note> =
        apiCall { api.updateNote(id, title, body) }

    override suspend fun delete(id: String): Result<Unit> = apiCall { api.deleteNote(id) }
}
