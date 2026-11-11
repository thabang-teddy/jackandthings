package com.jackandthings.ui.welcome

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import java.time.LocalTime
import kotlinx.coroutines.delay

/**
 * HH:MM:SS, reticking every second, as `Components/Glass/LiveClock.jsx` does.
 * Shared by the guest view and the dashboard's clock mode.
 */
@Composable
internal fun rememberClockText(): String {
    var now by remember { mutableStateOf(LocalTime.now()) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(1_000)
            now = LocalTime.now()
        }
    }

    return "%02d:%02d:%02d".format(now.hour, now.minute, now.second)
}
