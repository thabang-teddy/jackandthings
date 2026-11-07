package com.jackandthings

import android.content.Context
import com.jackandthings.data.AppPrefs
import com.jackandthings.data.TokenStore
import com.jackandthings.data.remote.ApiClient
import com.jackandthings.data.remote.JackApi
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

    val auth: AuthStore = AuthStore(api, client, tokens)

    val notes: NotesRepository = NotesRepository(api)
    val pomodoro: PomodoroRepository = PomodoroRepository(api)
    val clipboard: ClipboardRepository = ClipboardRepository(api)
    val workout: WorkoutRepository = WorkoutRepository(api)
    val budget: BudgetRepository = BudgetRepository(api)

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
