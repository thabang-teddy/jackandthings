package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.PomodoroLiveLinkState

/**
 * The live link: the Pomodoro state that is running right now, stored on the
 * server so the website and the phone can see each other's timer.
 *
 * One row per user, replaced on every timer change and deleted when the timer
 * stops. There is no offline half: a live link is meaningful only while a
 * session is active and the server is reachable.
 */
interface PomodoroLiveLinkRepository {

    /** The running timer, or null when nothing is active. */
    suspend fun get(): Result<PomodoroLiveLinkState?>

    /** Create or replace the live link with the timer state this device runs. */
    suspend fun update(state: PomodoroLiveLinkState): Result<PomodoroLiveLinkState>

    /** Stop the timer: delete the live link so no other device keeps showing it. */
    suspend fun delete(): Result<Unit>
}

class ApiPomodoroLiveLinkRepository(private val api: JackApi) : PomodoroLiveLinkRepository {

    override suspend fun get(): Result<PomodoroLiveLinkState?> =
        apiCall { api.pomodoroLiveLink() }

    override suspend fun update(state: PomodoroLiveLinkState): Result<PomodoroLiveLinkState> =
        apiCall { api.updatePomodoroLiveLink(state) }

    override suspend fun delete(): Result<Unit> = apiCall { api.deletePomodoroLiveLink() }
}
