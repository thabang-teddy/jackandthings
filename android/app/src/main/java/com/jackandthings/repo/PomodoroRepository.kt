package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.PomodoroPresetDraft
import com.jackandthings.model.PomodoroSession
import com.jackandthings.model.PomodoroSessionDraft
import com.jackandthings.model.PomodoroStats

/**
 * Presets only. A running countdown is still never persisted - see
 * PomodoroTimerEngine - so the live timer lives entirely in the UI layer.
 * Finished intervals are a separate concern; see [PomodoroSessionRepository].
 *
 * `create` takes a draft rather than a positional argument per field: a
 * preset carries fourteen since issue #3, and threading those through the
 * switching, offline and outbox layers one by one is how a field goes
 * missing on one path and nowhere else.
 */
interface PomodoroRepository {
    suspend fun list(): Result<List<PomodoroPreset>>

    suspend fun create(draft: PomodoroPresetDraft): Result<PomodoroPreset>

    suspend fun update(id: String, draft: PomodoroPresetDraft): Result<PomodoroPreset>

    suspend fun delete(id: String): Result<Unit>
}

class ApiPomodoroRepository(private val api: JackApi) : PomodoroRepository {

    override suspend fun list(): Result<List<PomodoroPreset>> = apiCall { api.presets() }

    override suspend fun create(draft: PomodoroPresetDraft): Result<PomodoroPreset> =
        apiCall { api.createPreset(draft) }

    override suspend fun update(id: String, draft: PomodoroPresetDraft): Result<PomodoroPreset> =
        apiCall { api.updatePreset(id, draft) }

    override suspend fun delete(id: String): Result<Unit> = apiCall { api.deletePreset(id) }
}

/**
 * Finished intervals and the analytics read off them.
 *
 * No update: a recorded interval is history, and the only honest correction
 * to "I did not really do that one" is to remove it - which is why the server
 * offers no update either.
 */
interface PomodoroSessionRepository {
    suspend fun list(limit: Int = 50): Result<List<PomodoroSession>>

    suspend fun create(draft: PomodoroSessionDraft): Result<PomodoroSession>

    suspend fun delete(id: String): Result<Unit>

    /** [timezone] is an IANA zone; the server buckets in it rather than UTC. */
    suspend fun stats(timezone: String): Result<PomodoroStats>
}

class ApiPomodoroSessionRepository(private val api: JackApi) : PomodoroSessionRepository {

    override suspend fun list(limit: Int): Result<List<PomodoroSession>> =
        apiCall { api.pomodoroSessions(limit) }

    override suspend fun create(draft: PomodoroSessionDraft): Result<PomodoroSession> =
        apiCall { api.createPomodoroSession(draft) }

    override suspend fun delete(id: String): Result<Unit> =
        apiCall { api.deletePomodoroSession(id) }

    override suspend fun stats(timezone: String): Result<PomodoroStats> =
        apiCall { api.pomodoroStats(timezone) }
}

/**
 * The signed-out case. Nothing is recorded: without an account there is
 * nowhere to put a history that would survive the app, and keeping a local
 * one that silently fails to sync on sign-in would be worse than not having
 * it. The timer itself works exactly the same, which is the part that matters
 * offline - see docs/ARCHITECTURE.md on running without an account.
 */
class NoOpPomodoroSessionRepository : PomodoroSessionRepository {

    override suspend fun list(limit: Int): Result<List<PomodoroSession>> =
        Result.success(emptyList())

    override suspend fun create(draft: PomodoroSessionDraft): Result<PomodoroSession> =
        Result.failure(IllegalStateException("Sign in to keep a focus history."))

    override suspend fun delete(id: String): Result<Unit> = Result.success(Unit)

    override suspend fun stats(timezone: String): Result<PomodoroStats> =
        Result.success(com.jackandthings.model.PomodoroStats(timezone = timezone))
}

/** Records and reports only while signed in; see [NoOpPomodoroSessionRepository]. */
class SwitchingPomodoroSessionRepository(
    private val auth: AuthStore,
    private val local: PomodoroSessionRepository,
    private val remote: PomodoroSessionRepository,
) : PomodoroSessionRepository {

    private val active: PomodoroSessionRepository
        get() = if (auth.signedIn.value) remote else local

    override suspend fun list(limit: Int) = active.list(limit)

    override suspend fun create(draft: PomodoroSessionDraft) = active.create(draft)

    override suspend fun delete(id: String) = active.delete(id)

    override suspend fun stats(timezone: String) = active.stats(timezone)
}
