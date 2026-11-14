package com.jackandthings.ui.workout

import com.jackandthings.model.BodyMetric
import com.jackandthings.model.BodyMetricDraft
import com.jackandthings.model.ProgressPhoto
import com.jackandthings.testing.FakeBodyRepository
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BodyViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val today = BodyMetric(id = "m-1", measuredOn = "2026-11-14", weightGrams = 82_400)
    private val photo = ProgressPhoto(id = "p-1", takenOn = "2026-11-14", url = "https://example.test/p")

    @Test
    fun `it loads the readings and the photos`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBodyRepository(mutableListOf(today), mutableListOf(photo))
            val model = BodyViewModel(repo)

            advanceUntilIdle()

            assertEquals(listOf(today), model.state.value.metrics)
            assertEquals(listOf(photo), model.state.value.photos)
            assertFalse(model.state.value.loading)
        }

    @Test
    fun `the latest reading is the first one`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val older = BodyMetric(id = "m-0", measuredOn = "2026-11-01", weightGrams = 83_000)
            val model = BodyViewModel(FakeBodyRepository(mutableListOf(today, older)))

            advanceUntilIdle()

            assertEquals(today, model.state.value.latest)
        }

    @Test
    fun `a failing photo list does not hide the figures`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBodyRepository(mutableListOf(today)).apply {
                photoFailure = RuntimeException("timed out")
            }
            val model = BodyViewModel(repo)

            advanceUntilIdle()

            // The figures are the page's point; the gallery is a second list.
            assertEquals(listOf(today), model.state.value.metrics)
            assertNull(model.state.value.error)
        }

    @Test
    fun `saving a reading sends the integers the server stores`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBodyRepository()
            val model = BodyViewModel(repo)
            advanceUntilIdle()

            model.compose()
            model.save(
                BodyMetricDraft(
                    measuredOn = "2026-11-14",
                    weightGrams = 82_400,
                    bodyFatPermille = 175,
                    measurements = mapOf("waist" to 860),
                ),
            )
            advanceUntilIdle()

            val saved = repo.saved.single()

            assertEquals(82_400, saved.weightGrams)
            // 17.5% as permille, so the half percent survives the round trip.
            assertEquals(175, saved.bodyFatPermille)
            assertEquals(mapOf("waist" to 860), saved.measurements)
            assertFalse(model.state.value.composing)
        }

    @Test
    fun `saving twice in a day replaces rather than stacks`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBodyRepository()
            val model = BodyViewModel(repo)
            advanceUntilIdle()

            model.save(BodyMetricDraft(measuredOn = "2026-11-14", weightGrams = 82_400))
            advanceUntilIdle()
            model.save(BodyMetricDraft(measuredOn = "2026-11-14", weightGrams = 82_100))
            advanceUntilIdle()

            // Weighing yourself twice in a morning is a correction.
            assertEquals(1, model.state.value.metrics.size)
            assertEquals(82_100, model.state.value.metrics.single().weightGrams)
        }

    @Test
    fun `uploading a photo passes the bytes and the picker's mime type`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBodyRepository()
            val model = BodyViewModel(repo)
            advanceUntilIdle()

            model.uploadPhoto(
                bytes = ByteArray(1_234),
                fileName = "front.jpg",
                mimeType = "image/jpeg",
                takenOn = "2026-11-14",
            )
            advanceUntilIdle()

            assertEquals(listOf(Triple("front.jpg", "image/jpeg", 1_234)), repo.uploads)
            assertFalse(model.state.value.uploading)
        }

    @Test
    fun `a failed upload says so rather than pretending it saved`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val repo = FakeBodyRepository().apply {
                failure = RuntimeException("Could not reach the server")
            }
            val model = BodyViewModel(repo)
            advanceUntilIdle()

            model.uploadPhoto(ByteArray(10), "front.jpg", "image/jpeg", "2026-11-14")
            advanceUntilIdle()

            // Uploads are not queued offline, so silence here would leave the
            // user believing a photo was kept when it was not.
            assertEquals("Could not reach the server", model.state.value.error)
            assertFalse(model.state.value.uploading)
            assertTrue(model.state.value.photos.isEmpty())
        }

    @Test
    fun `deleting a photo removes it`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakeBodyRepository(photos = mutableListOf(photo))
        val model = BodyViewModel(repo)
        advanceUntilIdle()

        model.deletePhoto("p-1")
        advanceUntilIdle()

        assertEquals(listOf("p-1"), repo.deletedPhotoIds)
        assertTrue(model.state.value.photos.isEmpty())
    }

    @Test
    fun `deleting a reading removes it`() = runTest(mainDispatcherRule.dispatcher.scheduler) {
        val repo = FakeBodyRepository(mutableListOf(today))
        val model = BodyViewModel(repo)
        advanceUntilIdle()

        model.deleteMetric("m-1")
        advanceUntilIdle()

        assertEquals(listOf("m-1"), repo.deletedMetricIds)
        assertTrue(model.state.value.metrics.isEmpty())
    }
}
