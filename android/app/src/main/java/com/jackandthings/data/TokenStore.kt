// Jetpack Security is deprecated upstream; create() explains why it is still
// used and what happens when the keystore refuses.
@file:Suppress("DEPRECATION")

package com.jackandthings.data

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.core.content.edit
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Holds the Sanctum personal-access token.
 *
 * The token is a bearer credential for the whole account, so it belongs in
 * [EncryptedSharedPreferences] rather than the ordinary preference file.
 * Keystore-backed encryption can fail on devices with a broken keystore, so a
 * failure falls back to a private preference file and says so in the log
 * instead of leaving the user unable to sign in at all.
 */
class TokenStore private constructor(private val prefs: SharedPreferences) {

    fun read(): String? = runCatching { prefs.getString(KEY_TOKEN, null) }
        .onFailure { Log.w(TAG, "Could not read the stored token", it) }
        .getOrNull()

    fun write(token: String) {
        prefs.edit { putString(KEY_TOKEN, token) }
    }

    fun clear() {
        prefs.edit { remove(KEY_TOKEN) }
    }

    companion object {
        private const val TAG = "TokenStore"
        private const val KEY_TOKEN = "jack_auth_token"
        private const val SECURE_FILE = "jack_secure"
        private const val PLAIN_FILE = "jack_secure_fallback"

        fun create(context: Context): TokenStore {
            val app = context.applicationContext

            val encrypted = runCatching {
                val key = MasterKey.Builder(app)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()
                EncryptedSharedPreferences.create(
                    app,
                    SECURE_FILE,
                    key,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
                )
            }.onFailure {
                Log.w(TAG, "Encrypted storage unavailable; using private prefs", it)
            }.getOrNull()

            return TokenStore(
                encrypted ?: app.getSharedPreferences(PLAIN_FILE, Context.MODE_PRIVATE),
            )
        }
    }
}
