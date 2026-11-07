package com.jackandthings

import android.content.Context
import com.jackandthings.data.AppPrefs
import com.jackandthings.data.TokenStore
import com.jackandthings.data.remote.ApiClient
import com.jackandthings.data.remote.JackApi
import com.jackandthings.repo.ApiAuthStore
import com.jackandthings.repo.ApiBudgetRepository
import com.jackandthings.repo.ApiClipboardRepository
import com.jackandthings.repo.ApiNotesRepository
import com.jackandthings.repo.ApiPomodoroRepository
import com.jackandthings.repo.ApiWorkoutRepository
import com.jackandthings.repo.AuthStore
import com.jackandthings.repo.BudgetRepository
import com.jackandthings.repo.ClipboardRepository
import com.jackandthings.repo.NotesRepository
import com.jackandthings.repo.PomodoroRepository
import com.jackandthings.repo.WorkoutRepository

/**
 * The app's object graph, assembled by hand.
 *
 * Small enough that a dependency-injection framework would add more ceremony
 * than it saves - the same call the sibling client in ../../giwubible/kotlin
 * makes. Everything here is a process-wide singleton, and everything below the
 * container still takes its collaborators through its constructor.
 */
class AppContainer(context: Context) {

    private val appContext = context.applicationContext

    val prefs: AppPrefs = AppPrefs.create(appContext)

    private val client: ApiClient = ApiClient(prefs.baseUrl.value)
    private val api: JackApi = JackApi(client)
    private val tokens: TokenStore = TokenStore.create(appContext)

    val auth: AuthStore = ApiAuthStore(api, client, tokens)

    // Declared as the interfaces so nothing above this line depends on the
    // API-backed implementations.
    val notes: NotesRepository = ApiNotesRepository(api)
    val pomodoro: PomodoroRepository = ApiPomodoroRepository(api)
    val clipboard: ClipboardRepository = ApiClipboardRepository(api)
    val workout: WorkoutRepository = ApiWorkoutRepository(api)
    val budget: BudgetRepository = ApiBudgetRepository(api)

    init {
        client.onUnauthenticated = auth::onUnauthenticated

        // The stored token has to reach the HTTP client before any screen can
        // issue a request, so the session is restored as the graph is built.
        auth.restore()
    }

    /** Applies a new server address to both the setting and the live client. */
    fun setBaseUrl(url: String) {
        prefs.setBaseUrl(url)
        client.setBaseUrl(prefs.baseUrl.value)
    }
}
