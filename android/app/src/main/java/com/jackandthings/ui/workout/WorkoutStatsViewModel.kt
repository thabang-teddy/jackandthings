package com.jackandthings.ui.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.WorkoutStats
import com.jackandthings.repo.TrainingRepository
import com.jackandthings.repo.readableMessage
import java.util.TimeZone
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class WorkoutStatsState(
    val stats: WorkoutStats? = null,
    val loading: Boolean = true,
    val error: String? = null,
)

/**
 * Volume, streaks, the calendar and the personal records.
 *
 * The zone is this device's own and is sent with the request: the server runs
 * in UTC, and "did I train today" bucketed in UTC is wrong for anybody not
 * living there - an evening workout in Johannesburg would land on the previous
 * day. The zone is read through an injected lambda so a test can pin it
 * instead of depending on where the machine running the test happens to be.
 */
class WorkoutStatsViewModel(
    private val training: TrainingRepository,
    private val timezone: () -> String = { TimeZone.getDefault().id },
) : ViewModel() {

    private val _state = MutableStateFlow(WorkoutStatsState())
    val state: StateFlow<WorkoutStatsState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }

        viewModelScope.launch {
            training.stats(timezone()).fold(
                onSuccess = { stats -> _state.update { it.copy(stats = stats, loading = false) } },
                onFailure = { error ->
                    _state.update { it.copy(loading = false, error = error.readableMessage()) }
                },
            )
        }
    }

    fun dismissError() = _state.update { it.copy(error = null) }

    companion object {
        fun factory(training: TrainingRepository) = viewModelFactory {
            initializer { WorkoutStatsViewModel(training) }
        }
    }
}
