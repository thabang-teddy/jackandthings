package com.jackandthings.ui.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.Note
import com.jackandthings.repo.NotesRepository
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class NotesState(
    val notes: List<Note> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: String? = null,
    /** Non-null while the editor is open; a blank id means a new note. */
    val editing: Note? = null,
)

class NotesViewModel(private val repo: NotesRepository) : ViewModel() {

    private val _state = MutableStateFlow(NotesState())
    val state: StateFlow<NotesState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            repo.list().fold(
                onSuccess = { list -> _state.update { it.copy(notes = list, loading = false) } },
                onFailure = { e ->
                    _state.update { it.copy(loading = false, error = e.readableMessage()) }
                },
            )
        }
    }

    fun startNew() = _state.update { it.copy(editing = Note(id = "", title = "", body = "")) }

    fun startEdit(note: Note) = _state.update { it.copy(editing = note) }

    fun cancelEdit() = _state.update { it.copy(editing = null) }

    fun dismissError() = _state.update { it.copy(error = null) }

    fun save(title: String, body: String) {
        val editing = _state.value.editing ?: return
        if (title.isBlank()) return

        _state.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            val result = if (editing.id.isBlank()) {
                repo.create(title.trim(), body)
            } else {
                repo.update(editing.id, title.trim(), body)
            }

            result.fold(
                onSuccess = {
                    _state.update { it.copy(saving = false, editing = null) }
                    refresh()
                },
                onFailure = { e ->
                    _state.update { it.copy(saving = false, error = e.readableMessage()) }
                },
            )
        }
    }

    /**
     * Starred notes are what the home screen pins. The list is patched in
     * place rather than refetched so the row does not flicker under the tap.
     */
    fun toggleStar(note: Note) {
        viewModelScope.launch {
            repo.setStarred(note.id, !note.isStarred).fold(
                onSuccess = { updated ->
                    _state.update { state ->
                        state.copy(
                            notes = state.notes.map { if (it.id == updated.id) updated else it },
                        )
                    }
                },
                onFailure = { e -> _state.update { it.copy(error = e.readableMessage()) } },
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

    companion object {
        fun factory(repo: NotesRepository) = viewModelFactory {
            initializer { NotesViewModel(repo) }
        }
    }
}
