package com.jackandthings.ui.clipboard

import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.ClipboardItem
import com.jackandthings.repo.ClipboardRepository
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ClipboardState(
    val items: List<ClipboardItem> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: String? = null,
    /** Non-null while the composer is open, pre-filled for shared text. */
    val draft: String? = null,
)

class ClipboardViewModel(private val repo: ClipboardRepository) : ViewModel() {

    private val _state = MutableStateFlow(ClipboardState())
    val state: StateFlow<ClipboardState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            repo.list().fold(
                onSuccess = { list -> _state.update { it.copy(items = list, loading = false) } },
                onFailure = { e ->
                    _state.update { it.copy(loading = false, error = e.readableMessage()) }
                },
            )
        }
    }

    fun startNew(prefill: String = "") = _state.update { it.copy(draft = prefill) }

    fun cancel() = _state.update { it.copy(draft = null) }

    fun dismissError() = _state.update { it.copy(error = null) }

    fun save(title: String, content: String) {
        if (content.isBlank()) return
        _state.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            repo.create(
                title = title.trim().takeIf { it.isNotBlank() },
                content = content,
                sourceDevice = deviceName(),
            ).fold(
                onSuccess = {
                    _state.update { it.copy(saving = false, draft = null) }
                    refresh()
                },
                onFailure = { e ->
                    _state.update { it.copy(saving = false, error = e.readableMessage()) }
                },
            )
        }
    }

    fun delete(id: String) {
        viewModelScope.launch {
            repo.delete(id).fold(
                onSuccess = { refresh() },
                onFailure = { e -> _state.update { it.copy(error = e.readableMessage()) } },
            )
        }
    }

    /** Stamped on each snippet so its origin is obvious across devices. */
    private fun deviceName(): String =
        "${Build.MANUFACTURER} ${Build.MODEL}".trim().take(MAX_DEVICE_NAME)

    companion object {
        private const val MAX_DEVICE_NAME = 30

        fun factory(repo: ClipboardRepository) = viewModelFactory {
            initializer { ClipboardViewModel(repo) }
        }
    }
}
