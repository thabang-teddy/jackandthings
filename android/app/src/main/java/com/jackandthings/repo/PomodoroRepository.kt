package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.PomodoroPreset

/**
 * Presets only. A running countdown is never persisted - the server has no
 * session table, by design - so the timer lives entirely in the UI layer.
 */
interface PomodoroRepository {
    suspend fun list(): Result<List<PomodoroPreset>>

    suspend fun create(name: String, focusMinutes: Int, breakMinutes: Int): Result<PomodoroPreset>

    suspend fun delete(id: String): Result<Unit>
}

class ApiPomodoroRepository(private val api: JackApi) : PomodoroRepository {

    override suspend fun list(): Result<List<PomodoroPreset>> = apiCall { api.presets() }

    override suspend fun create(
        name: String,
        focusMinutes: Int,
        breakMinutes: Int,
    ): Result<PomodoroPreset> = apiCall { api.createPreset(name, focusMinutes, breakMinutes) }

    override suspend fun delete(id: String): Result<Unit> = apiCall { api.deletePreset(id) }
}
