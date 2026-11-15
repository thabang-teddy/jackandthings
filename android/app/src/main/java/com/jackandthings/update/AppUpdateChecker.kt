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

/** What one check found, so a manual check can say more than "no banner". */
sealed interface UpdateCheck {
    data class Available(val version: AppVersion) : UpdateCheck
    data object UpToDate : UpdateCheck
    data object Unreachable : UpdateCheck
}

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
 * The decision half of a check, kept apart from the request so all three
 * outcomes can be asserted without a network.
 *
 * A missing response is [UpdateCheck.Unreachable], never "up to date":
 * claiming somebody's build is current because their phone was offline is a
 * claim the check cannot support.
 */
internal fun classifyUpdate(latest: AppVersion?, currentVersionName: String): UpdateCheck = when {
    latest == null -> UpdateCheck.Unreachable
    isNewer(latest.versionName, currentVersionName) -> UpdateCheck.Available(latest)
    else -> UpdateCheck.UpToDate
}

/**
 * Checks GitHub's public releases API for a newer build than the one running.
 *
 * [check] runs once per app open and surfaces a newer build as the dismissible
 * [available] banner; [checkNow] is the same request asked for from Settings,
 * where the result is said in place rather than left to a banner. The APK is
 * published there by the `apk` CI job (see build.gradle.kts), so that is also
 * the one place to ask whether a newer one exists - no server-side endpoint
 * needed.
 */
object AppUpdateChecker {

    private const val LATEST_RELEASE_URL =
        "https://api.github.com/repos/thabang-teddy/jackandthings/releases/latest"

    private val _available = MutableStateFlow<AppVersion?>(null)
    val available: StateFlow<AppVersion?> = _available.asStateFlow()

    private val client = OkHttpClient()

    suspend fun check(currentVersionName: String) {
        checkNow(currentVersionName)
    }

    /**
     * Runs the check and reports what it found. A newer release still arms
     * [available], so the banner reaches the rest of the app rather than
     * living only on the screen that asked.
     */
    suspend fun checkNow(currentVersionName: String): UpdateCheck {
        val outcome = classifyUpdate(fetchLatest(), currentVersionName)
        if (outcome is UpdateCheck.Available) _available.value = outcome.version
        return outcome
    }

    fun dismiss() {
        _available.value = null
    }

    private suspend fun fetchLatest(): AppVersion? = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder().url(LATEST_RELEASE_URL).build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) null else response.body?.string()?.let(::parseLatestRelease)
            }
        }.getOrNull()
    }

    internal fun resetForTesting() {
        _available.value = null
    }
}
