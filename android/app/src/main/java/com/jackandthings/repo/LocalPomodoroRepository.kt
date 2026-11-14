package com.jackandthings.repo

import com.jackandthings.data.local.JsonFileStore
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.PomodoroPresetDraft
import java.util.UUID

/** Backs the Pomodoro presets while there is no signed-in session to save to. */
class LocalPomodoroRepository(private val store: JsonFileStore<PomodoroPreset>) : PomodoroRepository {

    override suspend fun list(): Result<List<PomodoroPreset>> = Result.success(store.read())

    override suspend fun create(draft: PomodoroPresetDraft): Result<PomodoroPreset> {
        val preset = draft.toPreset(UUID.randomUUID().toString())
        store.write(applyDefaultRule(store.read(), preset))

        return Result.success(preset)
    }

    override suspend fun update(id: String, draft: PomodoroPresetDraft): Result<PomodoroPreset> {
        val existing = store.read().firstOrNull { it.id == id }
            ?: return Result.failure(NoSuchElementException("No preset $id"))

        val updated = draft.toPreset(existing.id)
        store.write(applyDefaultRule(store.read().map { if (it.id == id) updated else it }, updated))

        return Result.success(updated)
    }

    override suspend fun delete(id: String): Result<Unit> {
        store.write(store.read().filterNot { it.id == id })

        return Result.success(Unit)
    }

    /**
     * At most one default preset, matching the server's own rule in
     * PomodoroPreset::booted(). Enforced here too so signing in later does
     * not push up two presets that both claim to be the default.
     */
    private fun applyDefaultRule(
        presets: List<PomodoroPreset>,
        saved: PomodoroPreset,
    ): List<PomodoroPreset> {
        val withSaved = if (presets.any { it.id == saved.id }) {
            presets.map { if (it.id == saved.id) saved else it }
        } else {
            presets + saved
        }

        if (!saved.isDefault) return withSaved

        return withSaved.map {
            if (it.id == saved.id) it else it.copy(isDefault = false)
        }
    }
}
