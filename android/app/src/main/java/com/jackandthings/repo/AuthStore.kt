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
 * Restores the stored token into the HTTP client at startup so a returning user
 * lands straight on the app, and clears both on sign-out.
 */
class AuthStore(
    private val api: JackApi,
    private val client: ApiClient,
    private val tokens: TokenStore,
) {

    private val _signedIn = MutableStateFlow(false)
    val signedIn: StateFlow<Boolean> = _signedIn.asStateFlow()

    private val _user = MutableStateFlow<AuthUser?>(null)
    val user: StateFlow<AuthUser?> = _user.asStateFlow()

    /** Called once at startup, before the first screen decides what to show. */
    fun restore() {
        val stored = tokens.read()
        if (stored.isNullOrBlank()) return
        client.setAuthToken(stored)
        _signedIn.value = true
    }

    suspend fun signIn(email: String, password: String): Result<Unit> =
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
    suspend fun signOut() {
        apiCall { api.revokeToken() }
            .onFailure { Log.w(TAG, "Token revoke failed; clearing locally anyway", it) }

        tokens.clear()
        client.setAuthToken(null)
        _user.value = null
        _signedIn.value = false
    }

    /** Session expired or was revoked elsewhere; drop straight to sign-in. */
    fun onUnauthenticated() {
        tokens.clear()
        client.setAuthToken(null)
        _user.value = null
        _signedIn.value = false
    }

    private fun deviceName(): String = "${Build.MANUFACTURER} ${Build.MODEL}".trim()

    private companion object {
        const val TAG = "AuthStore"
    }
}
