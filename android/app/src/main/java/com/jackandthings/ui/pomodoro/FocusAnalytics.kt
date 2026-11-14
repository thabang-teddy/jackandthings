package com.jackandthings.ui.pomodoro

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.jackandthings.model.PomodoroStats

/**
 * The daily and weekly figures issue #3 asks for, read off
 * `GET pomodoro-sessions/stats`.
 *
 * The server does the bucketing, in this device's own timezone - see
 * App\Services\PomodoroAnalytics for why the client has to say which that is.
 * Nothing here derives data; it formats and draws.
 */

@Composable
fun FocusAnalyticsCard(stats: PomodoroStats, modifier: Modifier = Modifier) {
    Card(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Focus analytics", style = MaterialTheme.typography.titleMedium)

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Stat("Today", formatHoursMinutes(stats.today.focusSeconds), Modifier.weight(1f))
                Stat("Intervals", stats.today.intervals.toString(), Modifier.weight(1f))
                Stat("This week", formatHoursMinutes(stats.week.focusSeconds), Modifier.weight(1f))
                Stat("Streak", "${stats.streakDays}d", Modifier.weight(1f))
            }

            if (stats.days.isNotEmpty()) {
                DayChart(stats)
            }

            stats.mostProductiveHour?.let { hour ->
                Text(
                    "You focus most around %02d:00, over the last %d days.".format(hour, stats.historyDays),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (stats.tags.isNotEmpty()) {
                Text("Where the time went", style = MaterialTheme.typography.labelMedium)
                val total = stats.tags.sumOf { it.focusSeconds }.coerceAtLeast(1)
                stats.tags.take(5).forEach { bucket ->
                    TagRow(
                        tag = bucket.tag ?: "Untagged",
                        seconds = bucket.focusSeconds,
                        share = bucket.focusSeconds.toFloat() / total,
                    )
                }
            }

            stats.completionRate?.let { rate ->
                Text(
                    "$rate% of the focus intervals you started ran to the end. " +
                        "Times shown in ${stats.timezone}.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(value, style = MaterialTheme.typography.titleMedium)
    }
}

/**
 * Columns rather than a line: a day with nothing on it has to read as an
 * empty column, not as a line dipping through it. An empty day still draws a
 * floor so the bar is visible as "zero" rather than as nothing at all.
 */
@Composable
private fun DayChart(stats: PomodoroStats) {
    val peak = stats.days.maxOf { it.focusSeconds }.coerceAtLeast(1)

    Row(
        modifier = Modifier.fillMaxWidth().height(96.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        stats.days.forEach { day ->
            val fraction = if (day.focusSeconds == 0) {
                MIN_BAR_FRACTION
            } else {
                (day.focusSeconds.toFloat() / peak).coerceAtLeast(MIN_BAR_FRACTION)
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .semantics {
                        contentDescription =
                            "${day.label}: ${formatHoursMinutes(day.focusSeconds)}"
                    },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f, fill = false)
                        .height((80 * fraction).dp)
                        .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                        .background(
                            if (day.focusSeconds == 0) {
                                MaterialTheme.colorScheme.surfaceVariant
                            } else {
                                MaterialTheme.colorScheme.primary
                            },
                        ),
                )
                Text(day.label, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun TagRow(tag: String, seconds: Int, share: Float) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(tag, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(0.35f))
        Box(
            modifier = Modifier
                .weight(0.45f)
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(share)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(3.dp))
                    .background(MaterialTheme.colorScheme.primary),
            )
        }
        Text(
            formatHoursMinutes(seconds),
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.weight(0.2f),
        )
    }
}

/** Bars shorter than this are invisible, so an empty bucket still shows a floor. */
private const val MIN_BAR_FRACTION = 0.03f

/** "2h 3m", "45m" - nobody reads 7380 seconds as two hours. */
fun formatHoursMinutes(totalSeconds: Int): String {
    val seconds = totalSeconds.coerceAtLeast(0)
    val hours = seconds / 3600
    val minutes = ((seconds % 3600) + 30) / 60

    if (hours == 0) return "${minutes}m"
    // 59.6 minutes rounding to 60 would print "2h 60m"; carry it instead.
    if (minutes == 60) return "${hours + 1}h 0m"

    return "${hours}h ${minutes}m"
}
