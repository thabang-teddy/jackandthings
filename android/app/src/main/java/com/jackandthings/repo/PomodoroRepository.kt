package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.PomodoroPreset

/**
 * Presets only. A running countdown is never persisted - the server has no
 * session table, by design - so the timer lives entirely in the UI layer.
 */
class PomodoroRepository(private val api: JackApi) {

    suspend fun list(): Result<List<PomodoroPreset>> = apiCall { api.presets() }

    suspend fun create(name: String, focusMinutes: Int, breakMinutes: Int): Result<PomodoroPreset> =
        apiCall { api.createPreset(name, focusMinutes, breakMinutes) }

    suspend fun delete(id: String): Result<Unit> = apiCall { api.deletePreset(id) }
}
