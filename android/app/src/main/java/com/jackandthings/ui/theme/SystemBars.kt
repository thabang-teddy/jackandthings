package com.jackandthings.ui.theme

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * Makes the phone's own status and navigation bars agree with the app.
 *
 * Both bars are drawn by the system rather than by Compose, so until this
 * listed the two, an app forced to Light on a phone in dark mode kept
 * light-on-light buttons in the corner: the icons follow the window flags, not
 * the Material theme around them. The buttons are set to the inverse of the
 * bar, which is the rule Android applies to itself - on a dark bar they stay
 * light white, on a light one they go dark.
 *
 * The bar colours are only assigned below Android 15. From Android 15 the
 * platform draws every app edge to edge and ignores them, so the bar shows
 * whatever is behind it - here, the glass canvas [glassTokens] paints, which
 * already follows the same resolved appearance.
 */
@Composable
fun MatchSystemBars(darkTheme: Boolean) {
    val view = LocalView.current
    // Previews have no window to talk to.
    if (view.isInEditMode) return

    val barColor = glassTokens().bg
    val window = view.context.findActivity()?.window ?: return

    SideEffect {
        WindowCompat.getInsetsController(window, view).apply {
            isAppearanceLightStatusBars = !darkTheme
            isAppearanceLightNavigationBars = !darkTheme
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            @Suppress("DEPRECATION")
            window.statusBarColor = barColor.toArgb()
            @Suppress("DEPRECATION")
            window.navigationBarColor = barColor.toArgb()

            // Android 10+ otherwise lays a translucent scrim over a three-
            // button bar, which would turn the light bar grey.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.isNavigationBarContrastEnforced = false
            }
        }
    }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
