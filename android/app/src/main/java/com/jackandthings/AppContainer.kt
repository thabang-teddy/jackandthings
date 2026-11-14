package com.jackandthings

import android.content.Context
import com.jackandthings.data.AppPrefs
import com.jackandthings.data.TokenStore
import com.jackandthings.data.local.LocalStores
import com.jackandthings.data.local.OfflineCache
import com.jackandthings.data.local.Outbox
import com.jackandthings.data.remote.ApiClient
import com.jackandthings.data.remote.JackApi
import com.jackandthings.repo.ApiAuthStore
import com.jackandthings.repo.ApiBudgetRepository
import com.jackandthings.repo.ApiNotesRepository
import com.jackandthings.pomodoro.FocusGuard
import com.jackandthings.pomodoro.PomodoroSessionRecorder
import com.jackandthings.repo.ApiPomodoroRepository
import com.jackandthings.repo.ApiPomodoroSessionRepository
import com.jackandthings.repo.ApiWatchListRepository
import com.jackandthings.repo.ApiBodyRepository
import com.jackandthings.repo.ApiExerciseRepository
import com.jackandthings.repo.ApiTrainingRepository
import com.jackandthings.repo.ApiWorkoutRepository
import com.jackandthings.repo.BodyRepository
import com.jackandthings.repo.ExerciseRepository
import com.jackandthings.repo.TrainingRepository
import com.jackandthings.repo.AuthStore
import com.jackandthings.repo.BudgetRepository
import com.jackandthings.repo.LocalBudgetRepository
import com.jackandthings.repo.LocalNotesRepository
import com.jackandthings.repo.LocalPomodoroRepository
import com.jackandthings.repo.LocalWatchListRepository
import com.jackandthings.repo.LocalWorkoutRepository
import com.jackandthings.repo.NoOpPomodoroSessionRepository
import com.jackandthings.repo.NotesRepository
import com.jackandthings.repo.OfflineBudgetRepository
import com.jackandthings.repo.OfflineNotesRepository
import com.jackandthings.repo.OfflinePomodoroRepository
import com.jackandthings.repo.OfflineWatchListRepository
import com.jackandthings.repo.OfflineWorkoutRepository
import com.jackandthings.repo.OutboxDrainer
import com.jackandthings.repo.PomodoroRepository
import com.jackandthings.repo.PomodoroSessionRepository
import com.jackandthings.repo.SwitchingBudgetRepository
import com.jackandthings.repo.SwitchingNotesRepository
import com.jackandthings.repo.SwitchingPomodoroRepository
import com.jackandthings.repo.SwitchingPomodoroSessionRepository
import com.jackandthings.repo.SwitchingWatchListRepository
import com.jackandthings.repo.SwitchingWorkoutRepository
import com.jackandthings.repo.SyncManager
import com.jackandthings.repo.WatchListRepository
import com.jackandthings.repo.WorkoutRepository
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

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

    /** Process-lived, for the few jobs with no screen to own them. */
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val prefs: AppPrefs = AppPrefs.create(appContext)

    private val client: ApiClient = ApiClient(prefs.baseUrl.value)
    private val api: JackApi = JackApi(client)
    private val tokens: TokenStore = TokenStore.create(appContext)
    private val localStores = LocalStores(appContext.filesDir)

    private val authStore = ApiAuthStore(api, client, tokens)
    val auth: AuthStore = authStore

    // Each module is a remote (server-backed) and a local (file-backed)
    // implementation of the same interface, chosen per call by whether there
    // is a signed-in session - see SwitchingRepositories.kt. Nothing above
    // this line depends on either implementation, only the interfaces.
    //
    // A signed-in session still reaches the server on every call. These
    // decorators only come into play when it cannot be reached: they serve
    // the last list seen and queue the write for later. See Offline.kt.
    private val offlineCache = OfflineCache(appContext.filesDir)
    private val outbox = Outbox(File(appContext.filesDir, "outbox.json"))

    private val apiNotes = ApiNotesRepository(api)
    private val apiPomodoro = ApiPomodoroRepository(api)
    private val apiPomodoroSessions = ApiPomodoroSessionRepository(api)
    private val apiWatchList = ApiWatchListRepository(api)
    private val apiWorkout = ApiWorkoutRepository(api)
    private val apiBudget = ApiBudgetRepository(api)

    private val remoteNotes = OfflineNotesRepository(apiNotes, offlineCache, outbox)
    private val remotePomodoro = OfflinePomodoroRepository(apiPomodoro, offlineCache, outbox)
    private val remoteWatchList = OfflineWatchListRepository(apiWatchList, offlineCache, outbox)
    private val remoteWorkout = OfflineWorkoutRepository(apiWorkout, offlineCache, outbox)
    private val remoteBudget = OfflineBudgetRepository(apiBudget, offlineCache, outbox)

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

    /**
     * No local half, unlike every other module: without an account there is
     * nowhere to keep a focus history that would survive the app, and a local
     * one that silently failed to sync on sign-in would be worse than none.
     * The timer itself still works signed out, which is the part that matters.
     */
    val pomodoroSessions: PomodoroSessionRepository = SwitchingPomodoroSessionRepository(
        auth = auth,
        local = NoOpPomodoroSessionRepository(),
        remote = apiPomodoroSessions,
    )

    /** Writes a finished interval; see PomodoroSessionRecorder for why it is not in the ViewModel. */
    val pomodoroRecorder = PomodoroSessionRecorder(pomodoroSessions)

    /** Strict mode's Do Not Disturb half, which needs a Context the engine does not have. */
    val focusGuard = FocusGuard(appContext)
    val watchList: WatchListRepository = SwitchingWatchListRepository(auth, localWatchList, remoteWatchList)
    val workout: WorkoutRepository = SwitchingWorkoutRepository(auth, localWorkout, remoteWorkout)

    /*
     * Fitness tracking (issue #4). These three have no local, signed-out half
     * and no offline queue, unlike the modules above.
     *
     * The exercise library is server-seeded reference data - there is nothing
     * sensible to show a signed-out user, and shipping a second copy inside
     * the app would mean two catalogs to keep in step. Sets and routines could
     * in principle be queued, but a set belongs to a session that may not
     * exist on the server yet, so the outbox would need session-id remapping
     * inside the drainer before any of it could be replayed. That is a feature
     * of its own rather than a line in PendingAction.
     *
     * The one-line workout entry log above keeps its offline queue, so logging
     * "went for a run" on a train still works. docs/TESTING.md records the
     * limit.
     */
    val exercises: ExerciseRepository = ApiExerciseRepository(api)
    val training: TrainingRepository = ApiTrainingRepository(api)
    val body: BodyRepository = ApiBodyRepository(api)
    val budget: BudgetRepository = SwitchingBudgetRepository(auth, localBudget, remoteBudget)

    /**
     * Pushes whatever is waiting in [localStores] up to the server.
     *
     * Deliberately given the bare `api*` repositories rather than the offline
     * ones: a sign-in sync that cannot reach the server should say so in its
     * dialog, not quietly report success and move the backlog sideways into
     * the outbox.
     */
    val syncManager = SyncManager(
        stores = localStores,
        remoteNotes = apiNotes,
        remotePomodoro = apiPomodoro,
        remoteWorkout = apiWorkout,
        remoteBudget = apiBudget,
        remoteWatchList = apiWatchList,
    )

    /**
     * Replays writes made while signed in but offline. Also on the bare
     * `api*` repositories, so a replay that fails is retried from the queue
     * instead of being appended to it again.
     */
    val outboxDrainer = OutboxDrainer(
        outbox = outbox,
        cache = offlineCache,
        notes = apiNotes,
        pomodoro = apiPomodoro,
        workout = apiWorkout,
        watchList = apiWatchList,
        budget = apiBudget,
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

        // One last attempt to empty the outbox while the token still works.
        authStore.beforeSignOut = { outboxDrainer.drain() }

        // Cached rows are copies of one account's data, so they go with the
        // session. The outbox is kept: a 401 is usually an expired token and
        // the same person signs straight back in. This app has one user per
        // device (docs/PRD.md); two accounts sharing one would need the
        // queue keyed by user before it could be replayed safely.
        authStore.onSessionCleared = { scope.launch { offlineCache.clear() } }

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
