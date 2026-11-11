package com.jackandthings

import android.content.Context
import com.jackandthings.data.AppPrefs
import com.jackandthings.data.TokenStore
import com.jackandthings.data.local.LocalStores
import com.jackandthings.data.remote.ApiClient
import com.jackandthings.data.remote.JackApi
import com.jackandthings.repo.ApiAuthStore
import com.jackandthings.repo.ApiBudgetRepository
import com.jackandthings.repo.ApiNotesRepository
import com.jackandthings.repo.ApiPomodoroRepository
import com.jackandthings.repo.ApiWatchListRepository
import com.jackandthings.repo.ApiWorkoutRepository
import com.jackandthings.repo.AuthStore
import com.jackandthings.repo.BudgetRepository
import com.jackandthings.repo.LocalBudgetRepository
import com.jackandthings.repo.LocalNotesRepository
import com.jackandthings.repo.LocalPomodoroRepository
import com.jackandthings.repo.LocalWatchListRepository
import com.jackandthings.repo.LocalWorkoutRepository
import com.jackandthings.repo.NotesRepository
import com.jackandthings.repo.PomodoroRepository
import com.jackandthings.repo.SwitchingBudgetRepository
import com.jackandthings.repo.SwitchingNotesRepository
import com.jackandthings.repo.SwitchingPomodoroRepository
import com.jackandthings.repo.SwitchingWatchListRepository
import com.jackandthings.repo.SwitchingWorkoutRepository
import com.jackandthings.repo.SyncManager
import com.jackandthings.repo.WatchListRepository
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
    private val localStores = LocalStores(appContext.filesDir)

    val auth: AuthStore = ApiAuthStore(api, client, tokens)

    // Each module is a remote (server-backed) and a local (file-backed)
    // implementation of the same interface, chosen per call by whether there
    // is a signed-in session - see SwitchingRepositories.kt. Nothing above
    // this line depends on either implementation, only the interfaces.
    private val remoteNotes = ApiNotesRepository(api)
    private val remotePomodoro = ApiPomodoroRepository(api)
    private val remoteWatchList = ApiWatchListRepository(api)
    private val remoteWorkout = ApiWorkoutRepository(api)
    private val remoteBudget = ApiBudgetRepository(api)

    private val localNotes = LocalNotesRepository(localStores.notes)
    private val localPomodoro = LocalPomodoroRepository(localStores.presets)
    private val localWatchList = LocalWatchListRepository(localStores.watchLists)
    private val localWorkout = LocalWorkoutRepository(localStores.workoutEntries)
    private val localBudget = LocalBudgetRepository(
        accounts = localStores.budgetAccounts,
        transactions = localStores.budgetTransactions,
        transfers = localStores.pendingTransfers,
    )

    val notes: NotesRepository = SwitchingNotesRepository(auth, localNotes, remoteNotes)
    val pomodoro: PomodoroRepository = SwitchingPomodoroRepository(auth, localPomodoro, remotePomodoro)
    val watchList: WatchListRepository = SwitchingWatchListRepository(auth, localWatchList, remoteWatchList)
    val workout: WorkoutRepository = SwitchingWorkoutRepository(auth, localWorkout, remoteWorkout)
    val budget: BudgetRepository = SwitchingBudgetRepository(auth, localBudget, remoteBudget)

    /** Pushes whatever is waiting in [localStores] up to the server. */
    val syncManager = SyncManager(
        stores = localStores,
        remoteNotes = remoteNotes,
        remotePomodoro = remotePomodoro,
        remoteWorkout = remoteWorkout,
        remoteBudget = remoteBudget,
        remoteWatchList = remoteWatchList,
    )

    /**
     * The [auth] session state the sync prompt last reacted to, so it offers
     * once per sign-in - including a sign-out followed by a different
     * sign-in later in the same process - rather than only on the first one.
     * Null means "not yet observed", which a signed-in restore on a fresh
     * launch should still count as a transition into being signed in.
     */
    var lastSyncPromptSignedIn: Boolean? = null

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
