package com.jackandthings.ui.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.Exercise
import com.jackandthings.model.WorkoutRoutine
import com.jackandthings.model.WorkoutRoutineDraft
import com.jackandthings.repo.ExerciseRepository
import com.jackandthings.repo.TrainingRepository
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RoutineBuilderState(
    val routines: List<WorkoutRoutine> = emptyList(),
    val exercises: List<Exercise> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val composing: Boolean = false,
    val editing: WorkoutRoutine? = null,
    val error: String? = null,
)

/**
 * The routine builder.
 *
 * A routine and its items are saved as one draft rather than item by item: a
 * routine without its exercises is not half-saved, it is broken, and the
 * server writes both inside one transaction for the same reason.
 */
class RoutineBuilderViewModel(
    private val training: TrainingRepository,
    private val exercises: ExerciseRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(RoutineBuilderState())
    val state: StateFlow<RoutineBuilderState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }

        viewModelScope.launch {
            training.routines().fold(
                onSuccess = { list -> _state.update { it.copy(routines = list, loading = false) } },
                onFailure = { error ->
                    _state.update { it.copy(loading = false, error = error.readableMessage()) }
                },
            )
        }

        viewModelScope.launch {
            // Without the library there is nothing to build a routine from,
            // so a failure here is worth surfacing rather than swallowing.
            exercises.list().fold(
                onSuccess = { list -> _state.update { it.copy(exercises = list) } },
                onFailure = { error -> _state.update { it.copy(error = error.readableMessage()) } },
            )
        }
    }

    fun compose() = _state.update { it.copy(composing = true, editing = null) }

    fun edit(routine: WorkoutRoutine) =
        _state.update { it.copy(composing = true, editing = routine) }

    fun cancelCompose() = _state.update { it.copy(composing = false, editing = null) }

    fun save(draft: WorkoutRoutineDraft) {
        val editing = _state.value.editing

        _state.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            val result = if (editing == null) {
                training.createRoutine(draft)
            } else {
                training.updateRoutine(editing.id, draft)
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

    fun delete(routine: WorkoutRoutine) {
        viewModelScope.launch {
            training.deleteRoutine(routine.id).fold(
                // Workouts already run from it survive; the server keeps their
                // denormalised routine name.
                onSuccess = { refresh() },
                onFailure = { error -> _state.update { it.copy(error = error.readableMessage()) } },
            )
        }
    }

    fun dismissError() = _state.update { it.copy(error = null) }

    companion object {
        fun factory(training: TrainingRepository, exercises: ExerciseRepository) =
            viewModelFactory {
                initializer { RoutineBuilderViewModel(training, exercises) }
            }
    }
}
