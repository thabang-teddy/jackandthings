package com.jackandthings.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.jackandthings.repo.AuthStore
import com.jackandthings.repo.readableMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginState(
    val email: String = "",
    val password: String = "",
    val serverUrl: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
) {
    val canSubmit: Boolean
        get() = email.isNotBlank() && password.isNotBlank() && !submitting
}

class LoginViewModel(
    private val auth: AuthStore,
    private val applyServerUrl: (String) -> Unit,
    initialServerUrl: String,
) : ViewModel() {

    private val _state = MutableStateFlow(LoginState(serverUrl = initialServerUrl))
    val state: StateFlow<LoginState> = _state.asStateFlow()

    fun onEmailChange(value: String) = _state.update { it.copy(email = value, error = null) }

    fun onPasswordChange(value: String) = _state.update { it.copy(password = value, error = null) }

    fun onServerUrlChange(value: String) = _state.update { it.copy(serverUrl = value) }

    fun signIn() {
        val current = _state.value
        if (!current.canSubmit) return

        // Applied before the request so a corrected address takes effect on
        // this attempt rather than the next one.
        applyServerUrl(current.serverUrl)

        _state.update { it.copy(submitting = true, error = null) }

        viewModelScope.launch {
            auth.signIn(current.email.trim(), current.password)
                .onFailure { failure ->
                    _state.update {
                        it.copy(submitting = false, error = failure.readableMessage())
                    }
                }
            // On success the session flow flips and the navigator swaps the
            // screen out, so there is nothing to reset here.
        }
    }

    companion object {
        fun factory(
            auth: AuthStore,
            applyServerUrl: (String) -> Unit,
            initialServerUrl: String,
        ) = viewModelFactory {
            initializer { LoginViewModel(auth, applyServerUrl, initialServerUrl) }
        }
    }
}
