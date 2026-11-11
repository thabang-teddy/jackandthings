package com.jackandthings.repo

import com.jackandthings.data.local.JsonFileStore
import com.jackandthings.model.Note
import java.util.UUID

/** Backs the Notes module while there is no signed-in session to save to. */
class LocalNotesRepository(private val store: JsonFileStore<Note>) : NotesRepository {

    override suspend fun list(): Result<List<Note>> = Result.success(store.read())

    override suspend fun create(title: String, body: String?): Result<Note> {
        val note = Note(id = UUID.randomUUID().toString(), title = title, body = body)
        store.write(store.read() + note)
        return Result.success(note)
    }

    override suspend fun update(id: String, title: String, body: String?): Result<Note> {
        val updated = Note(id = id, title = title, body = body)
        store.write(store.read().map { if (it.id == id) updated else it })
        return Result.success(updated)
    }

    override suspend fun delete(id: String): Result<Unit> {
        store.write(store.read().filterNot { it.id == id })
        return Result.success(Unit)
    }
}
