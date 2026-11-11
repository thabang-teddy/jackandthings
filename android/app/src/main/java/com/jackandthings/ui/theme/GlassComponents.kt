package com.jackandthings.ui.theme

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * The handful of surfaces the glass design is built from, ported from
 * `laravel/resources/js/Components/Glass/`. They read [glassTokens] rather
 * than the Material scheme, so a screen mixes the two at its own risk.
 */

private val CardShape = RoundedCornerShape(22.dp)

/** `GlassCard.jsx`: a translucent panel with a small tracked caption. */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    title: String? = null,
    action: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val tokens = glassTokens()

    Column(
        modifier = modifier
            .clip(CardShape)
            .background(tokens.cardBg)
            .border(1.dp, tokens.cardBorder, CardShape)
            .padding(20.dp),
    ) {
        if (title != null || action != null) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (title != null) {
                    Text(
                        text = title.uppercase(),
                        color = tokens.muted,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.1.sp,
                    )
                }
                action?.invoke()
            }
        }

        content()
    }
}

/** `PillButton.jsx`: a small rounded action, filled when it is the primary one. */
@Composable
fun PillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    primary: Boolean = false,
    enabled: Boolean = true,
) {
    val tokens = glassTokens()

    Surface(
        onClick = onClick,
        enabled = enabled,
        shape = CircleShape,
        color = if (primary) tokens.accent else tokens.cardBg,
        contentColor = if (primary) tokens.accentInk else tokens.ink,
        border = if (primary) null else BorderStroke(1.dp, tokens.cardBorder),
        modifier = modifier.alpha(if (enabled) 1f else 0.4f),
    ) {
        Text(
            text = text,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 9.dp),
        )
    }
}

/**
 * Text-field colours for a glass surface. Without these a field inside a
 * glass dialog falls back to the Material scheme, which on Android 12+ is
 * whatever the wallpaper happens to be.
 */
@Composable
fun glassFieldColors(): TextFieldColors {
    val tokens = glassTokens()

    return OutlinedTextFieldDefaults.colors(
        focusedTextColor = tokens.ink,
        unfocusedTextColor = tokens.ink,
        cursorColor = tokens.accent,
        focusedBorderColor = tokens.accent,
        unfocusedBorderColor = tokens.cardBorder,
        focusedLabelColor = tokens.accent,
        unfocusedLabelColor = tokens.muted,
        focusedPlaceholderColor = tokens.muted,
        unfocusedPlaceholderColor = tokens.muted,
    )
}

/**
 * The round 44dp control the welcome page's rail is made of: a quick link,
 * or a toggle that fills with the accent colour while [active].
 */
@Composable
fun GlassCircleButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    active: Boolean = false,
) {
    val tokens = glassTokens()

    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = if (active) tokens.accent else tokens.cardBg,
        contentColor = if (active) tokens.accentInk else tokens.ink,
        border = BorderStroke(1.dp, if (active) tokens.accent else tokens.cardBorder),
        modifier = modifier.size(44.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}
