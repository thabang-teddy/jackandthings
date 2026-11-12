package com.jackandthings.repo

import android.os.Build
import android.util.Log
import com.jackandthings.data.TokenStore
import com.jackandthings.data.remote.ApiClient
import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.AuthUser
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * The signed-in session.
 *
 * An interface for the same reason the repositories are: the sign-in screen
 * should be testable without a server or a keystore.
 */
interface AuthStore {
    val signedIn: StateFlow<Boolean>

    val user: StateFlow<AuthUser?>

    /** Called once at startup, before the first screen decides what to show. */
    fun restore()

    suspend fun signIn(email: String, password: String): Result<Unit>

    suspend fun signOut()

    /** Session expired or was revoked elsewhere; drop straight to sign-in. */
    fun onUnauthenticated()
}

class ApiAuthStore(
    private val api: JackApi,
    private val client: ApiClient,
    private val tokens: TokenStore,
) : AuthStore {

    private val _signedIn = MutableStateFlow(false)
    override val signedIn: StateFlow<Boolean> = _signedIn.asStateFlow()

    private val _user = MutableStateFlow<AuthUser?>(null)
    override val user: StateFlow<AuthUser?> = _user.asStateFlow()

    /**
     * Run while the token is still valid, so anything queued offline gets one
     * last chance to reach the server before the session goes. Wired to the
     * outbox in AppContainer, the same way [ApiClient.onUnauthenticated] is.
     */
    var beforeSignOut: (suspend () -> Unit)? = null

    /**
     * Run once the session is gone, to drop cached copies of that account's
     * rows. Not doing so would leave one account's notes on screen for the
     * next one, which docs/SECURITY.md does not allow.
     */
    var onSessionCleared: (() -> Unit)? = null

    override fun restore() {
        val stored = tokens.read()
        if (stored.isNullOrBlank()) return
        client.setAuthToken(stored)
        _signedIn.value = true
    }

    override suspend fun signIn(email: String, password: String): Result<Unit> =
        apiCall { api.requestToken(email, password, deviceName()) }
            .map { payload ->
                tokens.write(payload.token)
                client.setAuthToken(payload.token)
                _user.value = payload.user
                _signedIn.value = true
            }

    /**
     * Clears local state even when the server call fails: the user asked to be
     * signed out, and a dead network should not keep them signed in. The token
     * row is then left behind on the server, which `sanctum:prune-expired`
     * would clean up once token expiry is configured.
     */
    override suspend fun signOut() {
        runCatching { beforeSignOut?.invoke() }
            .onFailure { Log.w(TAG, "Pre-sign-out sync failed; signing out anyway", it) }

        apiCall { api.revokeToken() }
            .onFailure { Log.w(TAG, "Token revoke failed; clearing locally anyway", it) }

        clearLocally()
    }

    override fun onUnauthenticated() {
        clearLocally()
    }

    private fun clearLocally() {
        tokens.clear()
        client.setAuthToken(null)
        _user.value = null
        _signedIn.value = false
        onSessionCleared?.invoke()
    }

    private fun deviceName(): String = "${Build.MANUFACTURER} ${Build.MODEL}".trim()

    private companion object {
        const val TAG = "AuthStore"
    }
}
