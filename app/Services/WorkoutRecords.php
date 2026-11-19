<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Exercise;
use App\Models\User;
use App\Models\WorkoutSet;
use Illuminate\Support\Collection;

/**
 * Personal records, and the "what did I do last time" figures that make
 * progressive overload possible during a live workout.
 *
 * Both answers come off workout_sets through the
 * (user_id, exercise_id, completed_at) index. Warm-up sets are excluded from
 * everything here: they are logged so a session reads honestly, but a warm-up
 * is never somebody's best.
 *
 * Estimated one-rep max uses Epley - weight * (1 + reps/30) - because it is
 * the formula most lifters already know, and because comparing two sets at
 * different weights and rep counts needs a single number. It stays in grams;
 * the clients display kilograms.
 */
class WorkoutRecords
{
    /** How many past sessions the "last time" panel reaches back through. */
    public const RECENT_SESSIONS = 3;

    /** The measures a personal record can be set in. */
    private const MEASURES = [
        'best_one_rep_max_grams',
        'best_weight_grams',
        'best_reps',
        'best_distance_metres',
        'best_duration_seconds',
    ];

    /**
     * What the user did the last time they trained this exercise, newest
     * session first, with each session's sets grouped together.
     *
     * Null when they have never logged it - which the UI shows as "no history
     * yet" rather than as a zero, because the two mean different things.
     *
     * @return array<string, mixed>|null
     */
    public function lastPerformance(User $user, Exercise $exercise): ?array
    {
        $sets = $user->workoutSets()
            ->counting()
            ->where('exercise_id', $exercise->getKey())
            ->with('session:id,started_at,routine_name')
            ->latest('completed_at')
            ->limit(60)
            ->get();

        if ($sets->isEmpty()) {
            return null;
        }

        $sessions = $sets
            ->groupBy('workout_session_id')
            ->take(self::RECENT_SESSIONS)
            ->map(fn (Collection $rows): array => [
                'session_id' => $rows->first()->workout_session_id,
                'performed_at' => $rows->first()->session?->started_at?->toIso8601String(),
                'routine_name' => $rows->first()->session?->routine_name,
                'sets' => $rows
                    ->sortBy('position')
                    ->map(fn (WorkoutSet $set): array => $this->setFigures($set))
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();

        return [
            'exercise_id' => $exercise->getKey(),
            'metric' => $exercise->metric->value,
            'sessions' => $sessions,
            'best' => $this->bestFrom($sets),
        ];
    }

    /**
     * This user's best figures for one exercise, across all time.
     *
     * @return array<string, int|null>
     */
    public function bestFor(User $user, Exercise $exercise): array
    {
        return $this->bestFrom(
            $user->workoutSets()
                ->counting()
                ->where('exercise_id', $exercise->getKey())
                ->get()
        );
    }

    /**
     * A record per exercise the user has ever trained, heaviest estimated
     * one-rep max first, for the stats page.
     *
     * One query rather than one per exercise, and grouped in PHP: a personal
     * data set is thousands of rows, and one pass keeps every figure
     * guaranteed consistent with the others - the same call PomodoroAnalytics
     * makes for the same reason.
     *
     * @return array<int, array<string, mixed>>
     */
    public function all(User $user): array
    {
        $sets = $user->workoutSets()
            ->counting()
            ->with('exercise:id,name,category,metric')
            ->get();

        return $sets
            ->groupBy('exercise_id')
            ->map(function (Collection $rows): array {
                $exercise = $rows->first()->exercise;

                return [
                    'exercise_id' => $rows->first()->exercise_id,
                    'exercise_name' => $exercise?->name,
                    'category' => $exercise?->category->value,
                    'metric' => $exercise?->metric->value,
                    'sets_logged' => $rows->count(),
                    'last_performed_at' => $rows->max('completed_at')?->toIso8601String(),
                    ...$this->bestFrom($rows),
                ];
            })
            ->sortByDesc(fn (array $row): int => $row['best_one_rep_max_grams'] ?? 0)
            ->values()
            ->all();
    }

    /**
     * Whether a set beats everything logged before it, so a new PR can be
     * flagged the moment it is saved.
     *
     * It compares against sets *other than* this one, so calling it after the
     * set has already been written still gives the right answer.
     */
    public function isRecord(User $user, WorkoutSet $set): bool
    {
        if ($set->is_warmup) {
            return false;
        }

        $previous = $this->bestFrom(
            $user->workoutSets()
                ->counting()
                ->where('exercise_id', $set->exercise_id)
                ->whereKeyNot($set->getKey())
                ->get()
        );

        $candidate = $this->bestFrom(collect([$set]));

        foreach (self::MEASURES as $measure) {
            if ($candidate[$measure] === null) {
                continue;
            }

            // A first-ever set of an exercise is a record by definition.
            if ($previous[$measure] === null || $candidate[$measure] > $previous[$measure]) {
                return true;
            }
        }

        return false;
    }

    /**
     * Estimated one-rep max in grams, by Epley. Null unless the set carries
     * both a load and a rep count, since the formula needs both.
     */
    public function estimatedOneRepMax(?int $weightGrams, ?int $reps): ?int
    {
        if ($weightGrams === null || $reps === null || $reps < 1) {
            return null;
        }

        // A single rep already *is* a one-rep max; Epley would inflate it.
        if ($reps === 1) {
            return $weightGrams;
        }

        return (int) round($weightGrams * (1 + $reps / 30));
    }

    /**
     * The best of each measure across a collection of sets. Every measure is
     * nullable: an exercise only carries the ones its metric tracks, and "no
     * data" is reported as null rather than as zero.
     *
     * @param  Collection<int, WorkoutSet>  $sets
     * @return array<string, int|null>
     */
    private function bestFrom(Collection $sets): array
    {
        $counting = $sets->reject(fn (WorkoutSet $set): bool => $set->is_warmup);

        if ($counting->isEmpty()) {
            return [
                'best_one_rep_max_grams' => null,
                'best_weight_grams' => null,
                'best_reps' => null,
                'best_distance_metres' => null,
                'best_duration_seconds' => null,
                'best_volume_grams' => null,
            ];
        }

        $oneRepMaxes = $counting
            ->map(fn (WorkoutSet $set): ?int => $this->estimatedOneRepMax($set->weight_grams, $set->reps))
            ->filter(fn (?int $value): bool => $value !== null);

        return [
            'best_one_rep_max_grams' => $oneRepMaxes->isEmpty() ? null : (int) $oneRepMaxes->max(),
            'best_weight_grams' => $this->maxOf($counting, 'weight_grams'),
            'best_reps' => $this->maxOf($counting, 'reps'),
            'best_distance_metres' => $this->maxOf($counting, 'distance_metres'),
            'best_duration_seconds' => $this->maxOf($counting, 'duration_seconds'),
            'best_volume_grams' => (int) $counting->sum(fn (WorkoutSet $set): int => $set->volumeGrams()),
        ];
    }

    /**
     * @param  Collection<int, WorkoutSet>  $sets
     */
    private function maxOf(Collection $sets, string $column): ?int
    {
        $values = $sets->pluck($column)->filter(fn (?int $value): bool => $value !== null);

        return $values->isEmpty() ? null : (int) $values->max();
    }

    /**
     * @return array<string, mixed>
     */
    private function setFigures(WorkoutSet $set): array
    {
        return [
            'id' => $set->getKey(),
            'position' => $set->position,
            'reps' => $set->reps,
            'weight_grams' => $set->weight_grams,
            'distance_metres' => $set->distance_metres,
            'duration_seconds' => $set->duration_seconds,
            'rpe' => $set->rpe,
            'one_rep_max_grams' => $this->estimatedOneRepMax($set->weight_grams, $set->reps),
        ];
    }
}
