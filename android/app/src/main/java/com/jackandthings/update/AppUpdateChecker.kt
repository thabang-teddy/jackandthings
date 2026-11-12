package com.jackandthings.update

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request

data class AppVersion(val versionName: String, val downloadUrl: String)

/**
 * Parses a GitHub "get the latest release" response body down to the two
 * fields this app cares about. Null for anything that isn't shaped the way
 * the API documents it, rather than throwing - a malformed or rate-limited
 * response should just mean "no update banner", never a crash on launch.
 */
internal fun parseLatestRelease(body: String): AppVersion? = runCatching {
    val json = Json.parseToJsonElement(body).jsonObject
    val tag = json["tag_name"]?.jsonPrimitive?.content ?: return null
    val url = json["html_url"]?.jsonPrimitive?.content ?: return null
    AppVersion(tag, url)
}.getOrNull()

/**
 * Compares release tags such as "0.1.47" numerically component by component,
 * so "0.1.9" reads as older than "0.1.10" rather than the other way around,
 * which plain string comparison would get wrong.
 */
internal fun isNewer(remote: String, local: String): Boolean {
    val remoteParts = versionParts(remote)
    val localParts = versionParts(local)

    for (i in 0 until maxOf(remoteParts.size, localParts.size)) {
        val r = remoteParts.getOrElse(i) { 0 }
        val l = localParts.getOrElse(i) { 0 }
        if (r != l) return r > l
    }
    return false
}

private fun versionParts(version: String) =
    version.trim().removePrefix("v").split(".").map { it.toIntOrNull() ?: 0 }

/**
 * Checks GitHub's public releases API once per app open for a newer build
 * than the one running, and surfaces it as a dismissible [available] a
 * screen can show a banner for. The APK itself is published there by the
 * `apk` CI job (see build.gradle.kts), so that is also the one place to ask
 * whether a newer one exists - no server-side endpoint needed.
 */
object AppUpdateChecker {

    private const val LATEST_RELEASE_URL =
        "https://api.github.com/repos/thabang-teddy/jackandthings/releases/latest"

    private val _available = MutableStateFlow<AppVersion?>(null)
    val available: StateFlow<AppVersion?> = _available.asStateFlow()

    private val client = OkHttpClient()

    suspend fun check(currentVersionName: String) {
        val latest = withContext(Dispatchers.IO) {
            runCatching {
                val request = Request.Builder().url(LATEST_RELEASE_URL).build()
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) null else response.body?.string()?.let(::parseLatestRelease)
                }
            }.getOrNull()
        }

        if (latest != null && isNewer(latest.versionName, currentVersionName)) {
            _available.value = latest
        }
    }

    fun dismiss() {
        _available.value = null
    }

    internal fun resetForTesting() {
        _available.value = null
    }
}
