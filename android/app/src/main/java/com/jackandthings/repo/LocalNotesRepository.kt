package com.jackandthings.repo

import com.jackandthings.data.local.JsonFileStore
import com.jackandthings.model.Note
import java.util.UUID

class LocalNotesRepository(private val store: JsonFileStore<Note>) : NotesRepository {

    override suspend fun list(): Result<List<Note>> = Result.success(store.read())

    override suspend fun create(title: String, body: String?): Result<Note> {
        val note = Note(id = UUID.randomUUID().toString(), title = title, body = body)
        store.write(store.read() + note)
        return Result.success(note)
    }

    /** Copied from the stored row so an edit does not clear the star. */
    override suspend fun update(id: String, title: String, body: String?): Result<Note> {
        val existing = store.read().firstOrNull { it.id == id }
        val updated = (existing ?: Note(id = id, title = title)).copy(title = title, body = body)
        store.write(store.read().map { if (it.id == id) updated else it })
        return Result.success(updated)
    }

    override suspend fun setStarred(id: String, isStarred: Boolean): Result<Note> {
        val existing = store.read().firstOrNull { it.id == id }
            ?: return Result.failure(IllegalStateException("That note is no longer here."))

        val updated = existing.copy(isStarred = isStarred)
        store.write(store.read().map { if (it.id == id) updated else it })
        return Result.success(updated)
    }

    override suspend fun delete(id: String): Result<Unit> {
        store.write(store.read().filterNot { it.id == id })
        return Result.success(Unit)
    }
}
