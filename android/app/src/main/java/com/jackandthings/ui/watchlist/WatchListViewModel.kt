package com.jackandthings.ui.watchlist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.model.WatchList
import com.jackandthings.model.WatchListItem
import com.jackandthings.repo.WatchListRepository
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class WatchListState(
    val lists: List<WatchList> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: String? = null,
)

class WatchListViewModel(private val repo: WatchListRepository) : ViewModel() {

    private val _state = MutableStateFlow(WatchListState())
    val state: StateFlow<WatchListState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            repo.lists().fold(
                onSuccess = { lists -> _state.update { it.copy(lists = lists, loading = false) } },
                onFailure = { e ->
                    _state.update { it.copy(loading = false, error = e.readableMessage()) }
                },
            )
        }
    }

    fun createList(name: String) {
        if (name.isBlank()) return
        _state.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            repo.createList(name.trim()).fold(
                onSuccess = {
                    _state.update { it.copy(saving = false) }
                    refresh()
                },
                onFailure = { e ->
                    _state.update { it.copy(saving = false, error = e.readableMessage()) }
                },
            )
        }
    }

    fun deleteList(id: String) = run(repo = { repo.deleteList(id) })

    fun addItem(watchListId: String, title: String) {
        if (title.isBlank()) return
        _state.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            repo.addItem(watchListId, title.trim(), note = null).fold(
                onSuccess = {
                    _state.update { it.copy(saving = false) }
                    refresh()
                },
                onFailure = { e ->
                    _state.update { it.copy(saving = false, error = e.readableMessage()) }
                },
            )
        }
    }

    fun toggleItem(item: WatchListItem) = run(repo = { repo.updateItem(item.id, !item.done) })

    fun deleteItem(id: String) = run(repo = { repo.deleteItem(id) })

    fun dismissError() = _state.update { it.copy(error = null) }

    /** Runs a mutation, then reloads on success or surfaces the error. */
    private fun run(repo: suspend () -> Result<*>) {
        viewModelScope.launch {
            repo().fold(
                onSuccess = { refresh() },
                onFailure = { e -> _state.update { it.copy(error = e.readableMessage()) } },
            )
        }
    }

    companion object {
        fun factory(repo: WatchListRepository) = viewModelFactory {
            initializer { WatchListViewModel(repo) }
        }
    }
}
