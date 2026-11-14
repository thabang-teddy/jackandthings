package com.jackandthings.ui.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.BodyMetric
import com.jackandthings.model.BodyMetricDraft
import com.jackandthings.model.ProgressPhoto
import com.jackandthings.repo.BodyRepository
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class BodyState(
    val metrics: List<BodyMetric> = emptyList(),
    val photos: List<ProgressPhoto> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val uploading: Boolean = false,
    val composing: Boolean = false,
    val error: String? = null,
) {
    val latest: BodyMetric?
        get() = metrics.firstOrNull()
}

/**
 * Body weight, body fat, tape measurements and progress photos.
 *
 * The upload takes bytes the screen has already read from the picked content
 * URI, so this ViewModel and its repository stay free of Context and can be
 * faked in a test like every other collaborator here.
 */
class BodyViewModel(
    private val repo: BodyRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(BodyState())
    val state: StateFlow<BodyState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }

        viewModelScope.launch {
            repo.metrics().fold(
                onSuccess = { list -> _state.update { it.copy(metrics = list, loading = false) } },
                onFailure = { error ->
                    _state.update { it.copy(loading = false, error = error.readableMessage()) }
                },
            )
        }

        viewModelScope.launch {
            // The photos are a second list; losing them should not hide the
            // figures, which are the page's point.
            repo.photos().onSuccess { list -> _state.update { it.copy(photos = list) } }
        }
    }

    fun compose() = _state.update { it.copy(composing = true) }

    fun cancelCompose() = _state.update { it.copy(composing = false) }

    /** A day that already has a reading is updated, not refused. */
    fun save(draft: BodyMetricDraft) {
        _state.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            repo.saveMetric(draft).fold(
                onSuccess = {
                    _state.update { it.copy(saving = false, composing = false) }
                    refresh()
                },
                onFailure = { error ->
                    _state.update { it.copy(saving = false, error = error.readableMessage()) }
                },
            )
        }
    }

    fun deleteMetric(id: String) {
        viewModelScope.launch {
            repo.deleteMetric(id).fold(
                onSuccess = { refresh() },
                onFailure = { error -> _state.update { it.copy(error = error.readableMessage()) } },
            )
        }
    }

    /**
     * Uploads one picked image. Not queued when offline, and the failure says
     * so rather than pretending it was saved - see BodyRepository for why.
     */
    fun uploadPhoto(
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
        takenOn: String,
        caption: String? = null,
        bodyMetricId: String? = null,
    ) {
        _state.update { it.copy(uploading = true, error = null) }

        viewModelScope.launch {
            repo.uploadPhoto(bytes, fileName, mimeType, takenOn, caption, bodyMetricId).fold(
                onSuccess = {
                    _state.update { it.copy(uploading = false) }
                    refresh()
                },
                onFailure = { error ->
                    _state.update { it.copy(uploading = false, error = error.readableMessage()) }
                },
            )
        }
    }

    fun deletePhoto(id: String) {
        viewModelScope.launch {
            repo.deletePhoto(id).fold(
                onSuccess = { refresh() },
                onFailure = { error -> _state.update { it.copy(error = error.readableMessage()) } },
            )
        }
    }

    fun dismissError() = _state.update { it.copy(error = null) }

    companion object {
        fun factory(repo: BodyRepository) = viewModelFactory {
            initializer { BodyViewModel(repo) }
        }
    }
}
