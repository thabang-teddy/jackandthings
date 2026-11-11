package com.jackandthings.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color

/**
 * The web app's glass palette, mirrored from
 * `laravel/resources/js/Lib/themeTokens.js` so the two clients read as one
 * product.
 *
 * Deliberately separate from [JackTheme]'s Material colours, which stay
 * dynamic: only screens ported from the web design read these, and the
 * module screens keep looking native until docs/DESIGN_SYSTEM.md settles on
 * one palette for both.
 */
@Immutable
data class GlassTokens(
    val bg: Color,
    val ink: Color,
    val muted: Color,
    val cardBg: Color,
    val cardBorder: Color,
    val accent: Color,
    val accentInk: Color,
    val glow1: Color,
    val glow2: Color,
    val glowOpacity: Float,
)

private val DarkGlass = GlassTokens(
    bg = Color(0xFF0A0F1E),
    ink = Color(0xFFEAF0FF),
    muted = Color(0xFFEAF0FF).copy(alpha = 0.50f),
    cardBg = Color.White.copy(alpha = 0.045f),
    cardBorder = Color.White.copy(alpha = 0.09f),
    accent = Color(0xFF2B6CFF),
    accentInk = Color(0xFF06121A),
    glow1 = Color(0xFF2B6CFF),
    glow2 = Color(0xFF17D9D4),
    glowOpacity = 0.35f,
)

private val LightGlass = GlassTokens(
    bg = Color(0xFFF2F5FB),
    ink = Color(0xFF141A2E),
    muted = Color(0xFF141A2E).copy(alpha = 0.55f),
    cardBg = Color.White.copy(alpha = 0.65f),
    cardBorder = Color(0xFF141A2E).copy(alpha = 0.08f),
    accent = Color(0xFF2B6CFF),
    accentInk = Color(0xFFFFFFFF),
    glow1 = Color(0xFF2B6CFF),
    glow2 = Color(0xFF17D9D4),
    glowOpacity = 0.16f,
)

@Composable
@ReadOnlyComposable
fun glassTokens(darkTheme: Boolean = isSystemInDarkTheme()): GlassTokens =
    if (darkTheme) DarkGlass else LightGlass
