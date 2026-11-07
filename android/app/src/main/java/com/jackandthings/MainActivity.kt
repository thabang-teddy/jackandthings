package com.jackandthings

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.jackandthings.ui.JackApp
import com.jackandthings.ui.theme.JackTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val container = (application as JackApplication).container
        val sharedText = intent?.sharedText()

        setContent {
            JackTheme {
                JackApp(container = container, sharedText = sharedText)
            }
        }
    }

    /** Text handed over by Android's share sheet, if that is why we opened. */
    private fun Intent.sharedText(): String? =
        takeIf { it.action == Intent.ACTION_SEND && it.type == "text/plain" }
            ?.getStringExtra(Intent.EXTRA_TEXT)
}
