package com.jackandthings.repo

import com.jackandthings.data.local.JsonFileStore
import com.jackandthings.model.PomodoroPreset
import java.util.UUID

/** Backs the Pomodoro presets while there is no signed-in session to save to. */
class LocalPomodoroRepository(private val store: JsonFileStore<PomodoroPreset>) : PomodoroRepository {

    override suspend fun list(): Result<List<PomodoroPreset>> = Result.success(store.read())

    override suspend fun create(
        name: String,
        focusMinutes: Int,
        breakMinutes: Int,
    ): Result<PomodoroPreset> {
        val preset = PomodoroPreset(
            id = UUID.randomUUID().toString(),
            name = name,
            focusMinutes = focusMinutes,
            breakMinutes = breakMinutes,
        )
        store.write(store.read() + preset)
        return Result.success(preset)
    }

    override suspend fun delete(id: String): Result<Unit> {
        store.write(store.read().filterNot { it.id == id })
        return Result.success(Unit)
    }
}
