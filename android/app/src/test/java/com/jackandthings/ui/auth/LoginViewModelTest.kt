package com.jackandthings.ui.auth

import com.jackandthings.testing.FakeAuthStore
import com.jackandthings.testing.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val defaultUrl = "http://10.0.2.2:8000/api/v1/"

    /** Records the address the screen asked the app to switch to. */
    private val appliedUrls = mutableListOf<String>()

    private fun viewModel(auth: FakeAuthStore) =
        LoginViewModel(auth, appliedUrls::add, defaultUrl)

    private fun LoginViewModel.fillIn(email: String = "test@example.com", password: String = "secret") {
        onEmailChange(email)
        onPasswordChange(password)
    }

    @Test
    fun `the server field starts on the configured address`() {
        val model = viewModel(FakeAuthStore())

        assertEquals(defaultUrl, model.state.value.serverUrl)
    }

    @Test
    fun `submitting needs both an email and a password`() {
        val model = viewModel(FakeAuthStore())
        assertFalse(model.state.value.canSubmit)

        model.onEmailChange("test@example.com")
        assertFalse(model.state.value.canSubmit)

        model.onPasswordChange("secret")
        assertTrue(model.state.value.canSubmit)
    }

    @Test
    fun `a blank password does not count as filled in`() {
        val model = viewModel(FakeAuthStore())
        model.fillIn(password = "   ")

        assertFalse(model.state.value.canSubmit)
    }

    @Test
    fun `signing in succeeds and flips the session`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val auth = FakeAuthStore()
            val model = viewModel(auth)
            model.fillIn()

            model.signIn()
            advanceUntilIdle()

            assertTrue(auth.signedIn.value)
            assertNull(model.state.value.error)
        }

    @Test
    fun `the email is trimmed before it is sent`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val auth = FakeAuthStore()
            val model = viewModel(auth)
            model.fillIn(email = "  test@example.com  ")

            model.signIn()
            advanceUntilIdle()

            assertEquals(listOf("test@example.com" to "secret"), auth.attempts)
        }

    @Test
    fun `the server address is applied before the request, not after`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val auth = FakeAuthStore()
            val model = viewModel(auth)
            model.fillIn()
            model.onServerUrlChange("http://192.168.0.10:8000/api/v1/")

            model.signIn()
            advanceUntilIdle()

            // A corrected address has to take effect on this attempt,
            // otherwise the first try always fails against the old server.
            assertEquals(listOf("http://192.168.0.10:8000/api/v1/"), appliedUrls)
        }

    @Test
    fun `a rejected sign-in reports the reason and stops the spinner`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val auth = FakeAuthStore().apply {
                failure = RuntimeException("These credentials do not match our records.")
            }
            val model = viewModel(auth)
            model.fillIn()

            model.signIn()
            advanceUntilIdle()

            assertEquals("These credentials do not match our records.", model.state.value.error)
            assertFalse(model.state.value.submitting)
            assertFalse(auth.signedIn.value)
            // Still usable, so the user can correct the password and retry.
            assertTrue(model.state.value.canSubmit)
        }

    @Test
    fun `typing again clears the previous error`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val model = viewModel(FakeAuthStore().apply { failure = RuntimeException("nope") })
            model.fillIn()
            model.signIn()
            advanceUntilIdle()
            assertEquals("nope", model.state.value.error)

            model.onPasswordChange("another-try")

            assertNull(model.state.value.error)
        }

    @Test
    fun `an incomplete form does not reach the server`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val auth = FakeAuthStore()
            val model = viewModel(auth)
            model.onEmailChange("test@example.com")

            model.signIn()
            advanceUntilIdle()

            assertEquals(emptyList<Pair<String, String>>(), auth.attempts)
            assertEquals(emptyList<String>(), appliedUrls)
        }

    @Test
    fun `a second tap while submitting does not send twice`() =
        runTest(mainDispatcherRule.dispatcher.scheduler) {
            val auth = FakeAuthStore()
            val model = viewModel(auth)
            model.fillIn()

            // The first call marks the state as submitting before suspending,
            // so the second finds canSubmit false.
            model.signIn()
            model.signIn()
            advanceUntilIdle()

            assertEquals(1, auth.attempts.size)
        }
}
