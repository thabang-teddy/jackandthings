package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.Note

class NotesRepository(private val api: JackApi) {

    suspend fun list(): Result<List<Note>> = apiCall { api.notes() }

    suspend fun create(title: String, body: String?): Result<Note> =
        apiCall { api.createNote(title, body) }

    suspend fun update(id: String, title: String, body: String?): Result<Note> =
        apiCall { api.updateNote(id, title, body) }

    suspend fun delete(id: String): Result<Unit> = apiCall { api.deleteNote(id) }
}
