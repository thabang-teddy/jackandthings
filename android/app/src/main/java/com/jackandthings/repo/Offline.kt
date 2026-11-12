package com.jackandthings.repo

import com.jackandthings.data.local.JsonFileStore
import com.jackandthings.data.remote.ApiException
import java.io.IOException

/**
 * Whether a failure means "the server could not be reached" rather than "the
 * server answered and said no".
 *
 * The distinction decides everything downstream: an unreachable server is
 * worth queueing the write for and retrying later, while a 422 would fail
 * again on every retry and belongs in front of the user now.
 *
 * [ApiException] extends [IOException] so that callers can catch one kind of
 * failure, which means the check cannot simply be `is IOException` - an HTTP
 * error would match it. Only a transport failure (no DNS, no route, timeout)
 * arrives as a plain IOException.
 */
val Throwable.isOffline: Boolean
    get() = this is IOException && this !is ApiException

/**
 * Serves [remote], falling back to [cache] when the server cannot be reached,
 * and refreshing the cache whenever it can.
 *
 * A failure the server itself produced is passed through untouched: showing
 * stale rows instead of "your session expired" would be worse than the error.
 */
suspend fun <T> readThroughCache(
    cache: JsonFileStore<T>,
    remote: suspend () -> Result<List<T>>,
): Result<List<T>> {
    val result = remote()

    result.fold(
        onSuccess = { fresh -> cache.write(fresh) },
        onFailure = { error -> if (error.isOffline) return Result.success(cache.read()) },
    )

    return result
}

/**
 * Runs [onOffline] only when [result] failed because the server could not be
 * reached. A success, or a refusal the server actually sent, is returned as
 * it stands.
 */
suspend fun <T> orWhenOffline(
    result: Result<T>,
    onOffline: suspend () -> Result<T>,
): Result<T> {
    val error = result.exceptionOrNull() ?: return result

    return if (error.isOffline) onOffline() else result
}
