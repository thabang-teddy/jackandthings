package com.jackandthings.repo

import com.jackandthings.data.remote.JackApi
import com.jackandthings.model.BodyMetric
import com.jackandthings.model.BodyMetricDraft
import com.jackandthings.model.ProgressPhoto

/**
 * Body weight, body fat, tape measurements and the progress photo records.
 *
 * An upload takes bytes the caller has already read, not a content URI, so
 * this interface stays free of Context and can be faked in a test like every
 * other collaborator. Reading the picked file is the screen's job.
 *
 * Uploads are not queued offline. The outbox serialises standalone JSON
 * drafts, and queueing an image would mean first copying it into the app's own
 * storage - a feature of its own, and one that would leave copies of somebody's
 * body photos on the device. It needs the server, and says so when it cannot
 * reach one.
 *
 * This is health data about a person: the images are never written to the
 * app's storage at all.
 */
interface BodyRepository {
    suspend fun metrics(): Result<List<BodyMetric>>

    /** A day that already has a reading is updated rather than refused. */
    suspend fun saveMetric(draft: BodyMetricDraft): Result<BodyMetric>

    suspend fun deleteMetric(id: String): Result<Unit>

    suspend fun photos(): Result<List<ProgressPhoto>>

    /**
     * [bytes] is the picked image already read; [mimeType] comes from the
     * picker, and the server validates it again against its own allow-list.
     */
    suspend fun uploadPhoto(
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
        takenOn: String,
        caption: String? = null,
        bodyMetricId: String? = null,
    ): Result<ProgressPhoto>

    /** Deletes the stored image as well as the record. */
    suspend fun deletePhoto(id: String): Result<Unit>
}

class ApiBodyRepository(private val api: JackApi) : BodyRepository {

    override suspend fun metrics(): Result<List<BodyMetric>> = apiCall { api.bodyMetrics() }

    override suspend fun saveMetric(draft: BodyMetricDraft): Result<BodyMetric> =
        apiCall { api.saveBodyMetric(draft) }

    override suspend fun deleteMetric(id: String): Result<Unit> =
        apiCall { api.deleteBodyMetric(id) }

    override suspend fun photos(): Result<List<ProgressPhoto>> = apiCall { api.progressPhotos() }

    override suspend fun uploadPhoto(
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
        takenOn: String,
        caption: String?,
        bodyMetricId: String?,
    ): Result<ProgressPhoto> = apiCall {
        api.uploadProgressPhoto(bytes, fileName, mimeType, takenOn, caption, bodyMetricId)
    }

    override suspend fun deletePhoto(id: String): Result<Unit> =
        apiCall { api.deleteProgressPhoto(id) }
}
