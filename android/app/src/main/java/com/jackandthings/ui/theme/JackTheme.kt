package com.jackandthings.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import com.jackandthings.data.ThemeMode

// docs/DESIGN_SYSTEM.md has no approved palette yet, so these mirror the
// indigo-on-slate the web app inherited from its starter kit. Dynamic colour
// takes over on Android 12+, which keeps the app looking native until a real
// brand palette is decided.
private val BrandPrimary = Color(0xFF4F46E5)
private val BrandPrimaryDark = Color(0xFFA5B4FC)

private val LightColors = lightColorScheme(primary = BrandPrimary)
private val DarkColors = darkColorScheme(primary = BrandPrimaryDark)

/**
 * The decision [JackTheme] made, published for the screens that read the glass
 * palette directly. Null means no theme above them - a preview, or a test that
 * renders a single composable - and lets [glassTokens] fall back to the
 * phone's setting. Without this, choosing Light while the phone is dark would
 * leave the welcome page and dashboard dark while every Material screen went
 * light.
 */
val LocalJackDarkTheme = staticCompositionLocalOf<Boolean?> { null }

/**
 * Resolves the saved [ThemeMode] once and hands the same answer to Material,
 * the glass tokens and the system bars, so no two of them can disagree about
 * which appearance is on screen.
 */
@Composable
fun JackTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val darkTheme = when (themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val colors = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)

        darkTheme -> DarkColors
        else -> LightColors
    }

    CompositionLocalProvider(LocalJackDarkTheme provides darkTheme) {
        MaterialTheme(colorScheme = colors) {
            MatchSystemBars(darkTheme)
            content()
        }
    }
}
