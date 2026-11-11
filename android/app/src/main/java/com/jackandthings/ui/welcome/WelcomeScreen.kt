package com.jackandthings.ui.welcome

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jackandthings.ui.theme.GlassCircleButton
import com.jackandthings.ui.theme.glassTokens

/**
 * The welcome page as a guest sees it, ported from
 * `laravel/resources/js/Pages/Welcome/GuestView.jsx`: the wordmark over a
 * live clock, with the sign-in affordance in the corner.
 *
 * The web guest has nowhere to go without an account. This one does, since
 * the modules run on local storage while signed out, so the rail carries a
 * link into the hub alongside the sign-in button.
 */
@Composable
fun WelcomeScreen(
    canSignIn: Boolean,
    onSignIn: () -> Unit,
    onOpenHub: () -> Unit,
) {
    val tokens = glassTokens()
    val clock = rememberClockText()

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        // Mirrors the page's text-7xl / sm:text-8xl step, which a phone needs
        // more than the web does: eight monospace digits at the larger size
        // run past the edge of a handset.
        val clockSize = if (maxWidth >= 600.dp) 96.sp else 64.sp

        Column(
            modifier = Modifier.align(Alignment.Center).padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = "JACK & THINGS",
                color = tokens.muted,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 3.6.sp,
                textAlign = TextAlign.Center,
            )

            Text(
                text = clock,
                color = tokens.ink,
                fontSize = clockSize,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                softWrap = false,
            )
        }

        Row(
            modifier = Modifier.align(Alignment.TopEnd).padding(24.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            GlassCircleButton(
                icon = Icons.Outlined.GridView,
                contentDescription = "Open the hub",
                onClick = onOpenHub,
            )

            if (canSignIn) {
                GlassCircleButton(
                    icon = Icons.Outlined.Person,
                    contentDescription = "Log in",
                    onClick = onSignIn,
                )
            }
        }
    }
}
