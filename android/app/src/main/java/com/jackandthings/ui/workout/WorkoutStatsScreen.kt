package com.jackandthings.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jackandthings.model.WorkoutCalendarDay
import com.jackandthings.model.WorkoutRecord
import com.jackandthings.ui.common.EmptyState
import com.jackandthings.ui.common.ErrorCard
import com.jackandthings.ui.common.LoadingBox
import com.jackandthings.ui.common.ModuleScaffold
import com.jackandthings.workout.WorkoutFormat

/**
 * Volume, streaks, the consistency calendar and the personal records.
 *
 * Every figure arrives pre-computed from App\Services\WorkoutAnalytics and
 * WorkoutRecords; this screen derives nothing but bar heights, so the phone
 * and the browser cannot disagree about a streak.
 */
@Composable
fun WorkoutStatsScreen(viewModel: WorkoutStatsViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val stats = state.stats

    ModuleScaffold(title = "Workout stats", onBack = onBack) { padding ->
        when {
            state.loading -> LoadingBox(Modifier.padding(padding))
            stats == null -> Column(Modifier.padding(padding)) {
                state.error?.let { ErrorCard(it) }
                EmptyState("No stats yet", "Log some sets and this fills in.")
            }
            else -> LazyColumn(
                modifier = Modifier.padding(padding).fillMaxWidth(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                state.error?.let { item { ErrorCard(it) } }

                item {
                    Card {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Day streak: ${stats.streakDays}")
                            Text("Longest streak: ${stats.longestStreakDays}")
                            Text(
                                "This week: ${stats.sessionsThisWeek} workout" +
                                    if (stats.sessionsThisWeek == 1) "" else "s",
                            )
                            Text("Volume this week: ${WorkoutFormat.volume(stats.week.volumeGrams)}")
                        }
                    }
                }

                item {
                    Card {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                "Volume, last ${stats.chartDays} days",
                                style = MaterialTheme.typography.titleSmall,
                            )
                            VolumeBars(stats.days.map { it.label to it.volumeGrams })
                            Text(
                                "Bars are weight times reps. Cardio and timed work count in the " +
                                    "totals but have no volume of their own.",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }

                item {
                    Card {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                "Consistency, last ${stats.historyDays} days",
                                style = MaterialTheme.typography.titleSmall,
                            )
                            Calendar(stats.calendar)
                            Text(
                                "Bucketed in ${stats.timezone}.",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }

                if (stats.records.isEmpty()) {
                    item {
                        EmptyState(
                            title = "No records yet",
                            description = "Warm-ups never count towards one.",
                        )
                    }
                } else {
                    item {
                        Text(
                            "Personal records",
                            style = MaterialTheme.typography.titleSmall,
                        )
                    }

                    items(stats.records, key = { it.exerciseId }) { record -> RecordCard(record) }
                }
            }
        }
    }
}

/**
 * Hand-drawn bars rather than a charting dependency, matching the web app's
 * FocusBarChart. A floor on the height keeps an empty day visible, because a
 * chart that drops empty days reads as a streak.
 */
@Composable
private fun VolumeBars(buckets: List<Pair<String, Long>>) {
    val peak = buckets.maxOfOrNull { it.second }?.coerceAtLeast(1L) ?: 1L

    Row(
        modifier = Modifier.fillMaxWidth().height(96.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = androidx.compose.ui.Alignment.Bottom,
    ) {
        buckets.forEach { (label, volume) ->
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
            ) {
                val share = (volume.toFloat() / peak).coerceAtLeast(0.02f)

                Box(
                    Modifier
                        .fillMaxWidth()
                        .height((72 * share).dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.primary),
                )
                Text(label, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

/** Every day in the window, trained or not: the gaps are the point. */
@Composable
private fun Calendar(days: List<WorkoutCalendarDay>) {
    androidx.compose.foundation.layout.FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        days.forEach { day ->
            Box(
                Modifier
                    .size(12.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(
                        if (day.trained) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.surfaceVariant
                        },
                    ),
            )
        }
    }
}

@Composable
private fun RecordCard(record: WorkoutRecord) {
    Card {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(record.exerciseName ?: "Exercise", style = MaterialTheme.typography.bodyLarge)

            // Only the measures this exercise actually tracks; a null is "not
            // measured", never a zero to print.
            listOfNotNull(
                record.bestOneRepMaxGrams?.let { "Est. 1RM ${WorkoutFormat.kg(it)}" },
                record.bestWeightGrams?.let { "Heaviest ${WorkoutFormat.kg(it)}" },
                record.bestReps?.let { "Most reps $it" },
                record.bestDistanceMetres?.let { "Furthest ${WorkoutFormat.distance(it)}" },
                record.bestDurationSeconds?.let { "Longest ${WorkoutFormat.seconds(it)}" },
            ).forEach { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
}
