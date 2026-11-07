package com.jackandthings.ui.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.WorkoutEntry
import com.jackandthings.repo.WorkoutRepository
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class WorkoutState(
    val entries: List<WorkoutEntry> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: String? = null,
    val composing: Boolean = false,
    /** True when nothing has been logged in the current hour. */
    val dueForReminder: Boolean = false,
    val lastLoggedAt: String? = null,
)

class WorkoutViewModel(private val repo: WorkoutRepository) : ViewModel() {

    private val _state = MutableStateFlow(WorkoutState())
    val state: StateFlow<WorkoutState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            repo.list().fold(
                onSuccess = { list -> _state.update { it.copy(entries = list, loading = false) } },
                onFailure = { e ->
                    _state.update { it.copy(loading = false, error = e.readableMessage()) }
                },
            )
            loadReminderState()
        }
    }

    /**
     * Only ever displayed. Raising an actual notification is the reminder
     * worker's job, and the server never sends one.
     */
    private suspend fun loadReminderState() {
        repo.reminderState().onSuccess { reminder ->
            _state.update {
                it.copy(dueForReminder = reminder.due, lastLoggedAt = reminder.lastLoggedAt)
            }
        }
    }

    fun startNew() = _state.update { it.copy(composing = true) }

    fun cancel() = _state.update { it.copy(composing = false) }

    fun dismissError() = _state.update { it.copy(error = null) }

    fun save(activity: String, notes: String) {
        if (activity.isBlank()) return
        _state.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            repo.create(activity.trim(), notes.trim().takeIf { it.isNotBlank() }).fold(
                onSuccess = {
                    _state.update { it.copy(saving = false, composing = false) }
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

    companion object {
        fun factory(repo: WorkoutRepository) = viewModelFactory {
            initializer { WorkoutViewModel(repo) }
        }
    }
}
