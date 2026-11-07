package com.jackandthings.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

// docs/DESIGN_SYSTEM.md has no approved palette yet, so these mirror the
// indigo-on-slate the web app inherited from its starter kit. Dynamic colour
// takes over on Android 12+, which keeps the app looking native until a real
// brand palette is decided.
private val BrandPrimary = Color(0xFF4F46E5)
private val BrandPrimaryDark = Color(0xFFA5B4FC)

private val LightColors = lightColorScheme(primary = BrandPrimary)
private val DarkColors = darkColorScheme(primary = BrandPrimaryDark)

@Composable
fun JackTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val colors = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)

        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(colorScheme = colors, content = content)
}
