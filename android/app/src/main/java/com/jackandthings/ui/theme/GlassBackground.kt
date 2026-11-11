package com.jackandthings.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * The welcome page's backdrop: the flat glass surface with a blue glow
 * bleeding in from the top-left corner and a teal one from the bottom-right.
 *
 * Mirrors the wrapper in `laravel/resources/js/Pages/Welcome.jsx`, which
 * draws the glows once around whichever of the two views is showing.
 */
@Composable
fun GlassBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val tokens = glassTokens()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(tokens.bg)
            .cornerGlows(tokens),
        content = content,
    )
}

/**
 * Radial gradients rather than blurred shapes: `Modifier.blur` only does
 * anything from API 31, and this app ships to 26.
 */
private fun Modifier.cornerGlows(tokens: GlassTokens): Modifier = drawBehind {
    fun glow(color: Color, center: Offset, radius: Float) {
        drawRect(
            brush = Brush.radialGradient(
                colors = listOf(color.copy(alpha = tokens.glowOpacity), Color.Transparent),
                center = center,
                radius = radius,
            ),
        )
    }

    // Same geometry as the web page: a 420px circle hanging off the top-left
    // corner and a 380px one off the bottom-right.
    glow(
        color = tokens.glow1,
        center = Offset(x = 90.dp.toPx(), y = 70.dp.toPx()),
        radius = 210.dp.toPx(),
    )
    glow(
        color = tokens.glow2,
        center = Offset(x = size.width - 90.dp.toPx(), y = size.height - 30.dp.toPx()),
        radius = 190.dp.toPx(),
    )
}
