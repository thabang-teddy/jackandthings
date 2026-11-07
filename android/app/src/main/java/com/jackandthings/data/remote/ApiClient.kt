package com.jackandthings.data.remote

import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

/** A non-2xx reply, carrying the status so callers can explain it. */
class ApiException(
    val statusCode: Int,
    override val message: String,
) : IOException(message)

/** The token was missing, expired, or revoked; the session has to start again. */
val ApiException.isUnauthenticated: Boolean
    get() = statusCode == 401

/**
 * The app's HTTP layer.
 *
 * Base URL and bearer token live here rather than at each call site, so a
 * change in Settings or a sign-out applies to every later request. Timeouts
 * are set explicitly: OkHttp's defaults are long enough to look like a hang.
 */
class ApiClient(
    baseUrl: String,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {

    @Volatile
    var baseUrl: String = normalize(baseUrl)
        private set

    @Volatile
    private var token: String? = null

    /**
     * Called when the server rejects the token. Wired to the session store so
     * an expired or revoked token drops the user to sign-in from wherever they
     * are, instead of every screen having to recognise a 401 for itself.
     */
    @Volatile
    var onUnauthenticated: (() -> Unit)? = null

    val json: Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        explicitNulls = false
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    fun setBaseUrl(url: String) {
        baseUrl = normalize(url)
    }

    /** Attaches, or with null removes, the bearer token on later requests. */
    fun setAuthToken(token: String?) {
        this.token = token
    }

    suspend fun get(path: String): JsonElement = withContext(io) {
        client.newCall(request(path).build()).execute().use { it.parseBody() }
    }

    suspend fun post(path: String, body: JsonObject? = null): JsonElement = withContext(io) {
        client.newCall(request(path).post(body.toJsonBody()).build()).execute().use { it.parseBody() }
    }

    suspend fun put(path: String, body: JsonObject? = null): JsonElement = withContext(io) {
        client.newCall(request(path).put(body.toJsonBody()).build()).execute().use { it.parseBody() }
    }

    suspend fun delete(path: String): Unit = withContext(io) {
        client.newCall(request(path).delete().build()).execute().use { response ->
            response.requireSuccess(response.body?.string().orEmpty())
        }
    }

    // ── Plumbing ───────────────────────────────────────────────────────────

    private fun JsonObject?.toJsonBody() =
        (this?.toString() ?: "{}").toRequestBody(JSON_MEDIA_TYPE)

    private fun request(path: String): Request.Builder {
        val builder = Request.Builder()
            .url(resolve(path))
            .header("Accept", "application/json")
        token?.let { builder.header("Authorization", "Bearer $it") }
        return builder
    }

    private fun resolve(path: String): HttpUrl {
        val base = baseUrl.toHttpUrlOrNull()
            ?: throw ApiException(0, "Server address is not valid: $baseUrl")
        return base.newBuilder().addPathSegments(path.trimStart('/')).build()
    }

    /**
     * A 204 carries no body, so an empty object stands in rather than failing
     * to parse. Deletes and transfers both reply that way.
     */
    private fun Response.parseBody(): JsonElement {
        val text = body?.string().orEmpty()
        requireSuccess(text)
        return if (text.isBlank()) JsonObject(emptyMap()) else json.parseToJsonElement(text)
    }

    private fun Response.requireSuccess(text: String) {
        if (isSuccessful) return
        if (code == 401) onUnauthenticated?.invoke()
        throw ApiException(statusCode = code, message = json.readError(text, code))
    }

    companion object {
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

        /**
         * Laravel sends `{"message": "..."}`, and for a 422 also an `errors`
         * map. The first field error is more use to the reader than the
         * generic "The given data was invalid", so it wins when present.
         */
        private fun Json.readError(body: String, code: Int): String {
            val parsed = runCatching { parseToJsonElement(body).jsonObject }.getOrNull()
                ?: return "Request failed with HTTP $code"

            val firstFieldError = runCatching {
                parsed["errors"]?.jsonObject?.values?.firstNotNullOfOrNull { field ->
                    (field as? kotlinx.serialization.json.JsonArray)
                        ?.firstOrNull()
                        ?.jsonPrimitive
                        ?.content
                }
            }.getOrNull()

            val message = (parsed["message"] as? JsonPrimitive)?.content

            return firstFieldError
                ?: message?.takeIf { it.isNotBlank() }
                ?: "Request failed with HTTP $code"
        }

        /**
         * Trailing slash included: the base URL carries the `/api/v1/` path,
         * and OkHttp drops the last segment when appending without it.
         */
        fun normalize(url: String): String = if (url.endsWith("/")) url else "$url/"
    }
}
