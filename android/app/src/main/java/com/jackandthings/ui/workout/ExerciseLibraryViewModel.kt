package com.jackandthings.ui.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.Exercise
import com.jackandthings.model.ExerciseDraft
import com.jackandthings.model.ExerciseHistory
import com.jackandthings.repo.ExerciseRepository
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ExerciseLibraryState(
    val exercises: List<Exercise> = emptyList(),
    val search: String = "",
    val category: String? = null,
    val expandedId: String? = null,
    /** History for the expanded exercise; null until it has been asked for. */
    val history: ExerciseHistory? = null,
    val loading: Boolean = true,
    val saving: Boolean = false,
    val composing: Boolean = false,
    val editing: Exercise? = null,
    val error: String? = null,
) {
    /** What the list actually shows, after the search box and the filter. */
    val visible: List<Exercise>
        get() = exercises.filter { exercise ->
            val matchesCategory = category == null || exercise.category == category
            val needle = search.trim().lowercase()
            val matchesSearch = needle.isEmpty() || listOfNotNull(
                exercise.name,
                exercise.primaryMuscle,
                exercise.equipment,
            ).any { it.lowercase().contains(needle) }

            matchesCategory && matchesSearch
        }

    /** Categories actually present, so the filter never offers an empty one. */
    val categories: List<String>
        get() = exercises.map { it.category }.distinct().sorted()
}

/**
 * The exercise library: browsing the catalog, and writing the user's own.
 *
 * A catalog exercise shows no edit controls because nobody may change one -
 * ExercisePolicy refuses it server-side, and offering a button that always
 * fails would be worse than not offering it.
 */
class ExerciseLibraryViewModel(
    private val repo: ExerciseRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ExerciseLibraryState())
    val state: StateFlow<ExerciseLibraryState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }

        viewModelScope.launch {
            repo.list().fold(
                onSuccess = { list ->
                    _state.update { it.copy(exercises = list, loading = false) }
                },
                onFailure = { error ->
                    _state.update { it.copy(loading = false, error = error.readableMessage()) }
                },
            )
        }
    }

    fun search(text: String) = _state.update { it.copy(search = text) }

    fun filterBy(category: String?) = _state.update { it.copy(category = category) }

    /**
     * Expanding an exercise also fetches what the user last did with it. A
     * failure there is swallowed: the instructions are the point of the
     * library, and losing the history should not hide them.
     */
    fun toggle(exercise: Exercise) {
        val alreadyOpen = _state.value.expandedId == exercise.id

        _state.update {
            it.copy(
                expandedId = if (alreadyOpen) null else exercise.id,
                history = null,
            )
        }

        if (alreadyOpen) return

        viewModelScope.launch {
            repo.history(exercise.id).onSuccess { history ->
                // Guards against a slow reply landing after the user has
                // already opened a different exercise.
                if (_state.value.expandedId == exercise.id) {
                    _state.update { it.copy(history = history) }
                }
            }
        }
    }

    fun compose() = _state.update { it.copy(composing = true, editing = null) }

    fun edit(exercise: Exercise) = _state.update { it.copy(composing = true, editing = exercise) }

    fun cancelCompose() = _state.update { it.copy(composing = false, editing = null) }

    fun save(draft: ExerciseDraft) {
        val editing = _state.value.editing

        _state.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            val result = if (editing == null) {
                repo.create(draft)
            } else {
                repo.update(editing.id, draft)
            }

            result.fold(
                onSuccess = {
                    _state.update { it.copy(saving = false, composing = false, editing = null) }
                    refresh()
                },
                onFailure = { error ->
                    _state.update { it.copy(saving = false, error = error.readableMessage()) }
                },
            )
        }
    }

    fun delete(exercise: Exercise) {
        viewModelScope.launch {
            repo.delete(exercise.id).fold(
                onSuccess = { refresh() },
                // The server refuses this with a readable 422 while a routine
                // or a logged set still uses the exercise; show that, do not
                // translate it into something vaguer.
                onFailure = { error -> _state.update { it.copy(error = error.readableMessage()) } },
            )
        }
    }

    fun dismissError() = _state.update { it.copy(error = null) }

    companion object {
        fun factory(repo: ExerciseRepository) = viewModelFactory {
            initializer { ExerciseLibraryViewModel(repo) }
        }
    }
}
