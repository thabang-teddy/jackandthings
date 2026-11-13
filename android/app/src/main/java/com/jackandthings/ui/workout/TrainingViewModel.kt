package com.jackandthings.ui.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.Exercise
import com.jackandthings.model.WorkoutRoutine
import com.jackandthings.model.WorkoutSession
import com.jackandthings.model.WorkoutSessionDraft
import com.jackandthings.model.WorkoutSetDraft
import com.jackandthings.repo.ExerciseRepository
import com.jackandthings.repo.TrainingRepository
import com.jackandthings.repo.readableMessage
import com.jackandthings.workout.NextSet
import com.jackandthings.workout.RestTimerState
import com.jackandthings.workout.WorkoutProgress
import com.jackandthings.workout.WorkoutRestTimer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class TrainingState(
    val session: WorkoutSession? = null,
    val routines: List<WorkoutRoutine> = emptyList(),
    val exercises: List<Exercise> = emptyList(),
    val sessions: List<WorkoutSession> = emptyList(),
    val rest: RestTimerState = RestTimerState(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: String? = null,
    /** Set briefly after a logged set that beat a previous best. */
    val recordJustSet: Boolean = false,
) {
    /** The routine the running workout came from, if any. */
    val routine: WorkoutRoutine?
        get() = routines.firstOrNull { it.id == session?.workoutRoutineId }

    /** What the routine says to do next, or null when it is done or absent. */
    val nextSet: NextSet?
        get() = routine?.let { WorkoutProgress.nextSet(it.items, session?.sets.orEmpty()) }

    val progress: String?
        get() = routine?.let {
            val progress = WorkoutProgress.routineProgress(it.items, session?.sets.orEmpty())

            "${progress.done} of ${progress.target}"
        }
}

/**
 * The live workout: starting one, logging sets into it, and finishing it.
 *
 * The session itself is read from the server rather than held here, so a
 * workout started in the browser shows up on the phone and the two cannot
 * disagree about what has been logged. Only the rest countdown is local, and
 * it lives in WorkoutRestTimer rather than in this ViewModel so it survives
 * navigating away from the screen.
 */
class TrainingViewModel(
    private val training: TrainingRepository,
    private val exercises: ExerciseRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(TrainingState())
    val state: StateFlow<TrainingState> = _state.asStateFlow()

    init {
        refresh()

        viewModelScope.launch {
            WorkoutRestTimer.state.collect { rest -> _state.update { it.copy(rest = rest) } }
        }
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }

        viewModelScope.launch {
            training.currentSession().fold(
                onSuccess = { session -> _state.update { it.copy(session = session, loading = false) } },
                onFailure = { error ->
                    _state.update { it.copy(loading = false, error = error.readableMessage()) }
                },
            )
        }

        viewModelScope.launch {
            training.routines().onSuccess { routines ->
                _state.update { it.copy(routines = routines) }
            }
        }

        viewModelScope.launch {
            // The library is a nicety for the picker; failing to load it must
            // not take the workout down with it.
            exercises.list().onSuccess { list -> _state.update { it.copy(exercises = list) } }
        }

        viewModelScope.launch {
            training.sessions().onSuccess { list -> _state.update { it.copy(sessions = list) } }
        }
    }

    /** [routineId] null starts a freestyle workout, which is a real workout. */
    fun startWorkout(routineId: String?) {
        _state.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            training.startSession(WorkoutSessionDraft(workoutRoutineId = routineId)).fold(
                onSuccess = { session ->
                    _state.update { it.copy(session = session, saving = false) }
                },
                onFailure = { error ->
                    _state.update { it.copy(saving = false, error = error.readableMessage()) }
                },
            )
        }
    }

    /**
     * Logs a set and starts the rest countdown from the routine's own figure.
     * The record flag comes from the server's reply rather than being worked
     * out here, so the phone and the browser celebrate the same sets.
     */
    fun logSet(draft: WorkoutSetDraft) {
        val sessionId = _state.value.session?.id ?: return
        val restSeconds = WorkoutProgress.restSecondsFor(_state.value.nextSet?.item)
        val label = _state.value.nextSet?.item?.exerciseName

        _state.update { it.copy(saving = true, error = null, recordJustSet = false) }

        viewModelScope.launch {
            training.logSet(sessionId, draft).fold(
                onSuccess = { logged ->
                    WorkoutRestTimer.start(restSeconds, label)
                    _state.update { it.copy(saving = false, recordJustSet = logged.isRecord) }
                    reloadSession()
                },
                onFailure = { error ->
                    _state.update { it.copy(saving = false, error = error.readableMessage()) }
                },
            )
        }
    }

    fun deleteSet(id: String) {
        viewModelScope.launch {
            training.deleteSet(id).fold(
                onSuccess = { reloadSession() },
                onFailure = { error -> _state.update { it.copy(error = error.readableMessage()) } },
            )
        }
    }

    fun finishWorkout() {
        val sessionId = _state.value.session?.id ?: return

        _state.update { it.copy(saving = true) }

        viewModelScope.launch {
            training.finishSession(sessionId).fold(
                onSuccess = {
                    // The rest of a finished workout is over by definition.
                    WorkoutRestTimer.stop()
                    _state.update { it.copy(session = null, saving = false) }
                    refresh()
                },
                onFailure = { error ->
                    _state.update { it.copy(saving = false, error = error.readableMessage()) }
                },
            )
        }
    }

    fun deleteSession(id: String) {
        viewModelScope.launch {
            training.deleteSession(id).fold(
                onSuccess = { refresh() },
                onFailure = { error -> _state.update { it.copy(error = error.readableMessage()) } },
            )
        }
    }

    fun skipRest() = WorkoutRestTimer.stop()

    fun extendRest(seconds: Int) = WorkoutRestTimer.extend(seconds)

    fun clearRecordFlag() = _state.update { it.copy(recordJustSet = false) }

    fun dismissError() = _state.update { it.copy(error = null) }

    private suspend fun reloadSession() {
        training.currentSession().onSuccess { session ->
            _state.update { it.copy(session = session) }
        }
    }

    companion object {
        fun factory(training: TrainingRepository, exercises: ExerciseRepository) =
            viewModelFactory {
                initializer { TrainingViewModel(training, exercises) }
            }
    }
}
