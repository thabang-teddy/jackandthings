package com.jackandthings.repo

import kotlin.coroutines.cancellation.CancellationException

/**
 * Wraps an API call as a [Result].
 *
 * Deliberately not `runCatching`: that swallows [CancellationException] too,
 * which would leave a cancelled coroutine looking like a failed request and
 * break structured concurrency. Cancellation is rethrown.
 */
suspend fun <T> apiCall(block: suspend () -> T): Result<T> =
    try {
        Result.success(block())
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        Result.failure(e)
    }

/** The message to put in front of the user when a call fails. */
fun Throwable.readableMessage(): String =
    message?.takeIf { it.isNotBlank() } ?: "Something went wrong. Please try again."
