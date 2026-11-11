package com.jackandthings.data.local

import java.io.File
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * A JSON-file-backed list, used to hold one module's data while there is no
 * signed-in session to save it to instead.
 *
 * The whole list is read and rewritten on every change, which is fine at the
 * size a single person's offline backlog reaches; there is no concurrent
 * writer to race against beyond this process.
 */
class JsonFileStore<T>(
    private val file: File,
    elementSerializer: KSerializer<T>,
) {
    private val mutex = Mutex()
    private val json = Json { ignoreUnknownKeys = true }
    private val listSerializer = ListSerializer(elementSerializer)

    suspend fun read(): List<T> = mutex.withLock {
        if (!file.exists()) {
            emptyList()
        } else {
            runCatching { json.decodeFromString(listSerializer, file.readText()) }
                .getOrDefault(emptyList())
        }
    }

    suspend fun write(items: List<T>) = mutex.withLock {
        file.writeText(json.encodeToString(listSerializer, items))
    }
}
