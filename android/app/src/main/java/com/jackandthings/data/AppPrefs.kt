package com.jackandthings.data

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import com.jackandthings.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Settings that are not secret: which server to talk to, and whether the
 * hourly workout reminder is wanted.
 *
 * The server address is editable because the useful value differs per setup -
 * 10.0.2.2 from an emulator, a LAN address from a real handset, a domain once
 * this is deployed - and none of those should need a rebuild.
 */
class AppPrefs private constructor(private val prefs: SharedPreferences) {

    private val _baseUrl = MutableStateFlow(
        prefs.getString(KEY_BASE_URL, null) ?: BuildConfig.API_BASE_URL,
    )
    val baseUrl: StateFlow<String> = _baseUrl.asStateFlow()

    private val _remindersEnabled = MutableStateFlow(
        prefs.getBoolean(KEY_REMINDERS, true),
    )
    val remindersEnabled: StateFlow<Boolean> = _remindersEnabled.asStateFlow()

    fun setBaseUrl(url: String) {
        val cleaned = url.trim()
        if (cleaned.isEmpty()) return
        prefs.edit { putString(KEY_BASE_URL, cleaned) }
        _baseUrl.value = cleaned
    }

    fun setRemindersEnabled(enabled: Boolean) {
        prefs.edit { putBoolean(KEY_REMINDERS, enabled) }
        _remindersEnabled.value = enabled
    }

    companion object {
        private const val FILE = "jack_prefs"
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_REMINDERS = "reminders_enabled"

        fun create(context: Context): AppPrefs = AppPrefs(
            context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE),
        )
    }
}
