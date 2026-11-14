<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Which numbers a set of this exercise actually carries.
 *
 * This is the field that stops the UI asking for a weight on a plank and a
 * distance on a bench press. A `workout_sets` row has a column for every
 * measure and fills only the ones its exercise's metric names; everything
 * else stays null. The clients read the same enum to decide which inputs to
 * draw, so "which numbers does this exercise have" is answered once, on the
 * server, rather than three times in three UIs.
 */
enum ExerciseMetric: string
{
    /** Reps against a load - the barbell and dumbbell lifts. */
    case WeightReps = 'weight_reps';

    /** Reps with no load - push-ups, pull-ups, sit-ups. */
    case RepsOnly = 'reps_only';

    /** Ground covered over time - running, rowing, cycling. */
    case DistanceDuration = 'distance_duration';

    /** Time alone - planks, holds, stretches. */
    case Duration = 'duration';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $metric): string => $metric->value, self::cases());
    }

    public function tracksWeight(): bool
    {
        return $this === self::WeightReps;
    }

    public function tracksReps(): bool
    {
        return $this === self::WeightReps || $this === self::RepsOnly;
    }

    public function tracksDistance(): bool
    {
        return $this === self::DistanceDuration;
    }

    public function tracksDuration(): bool
    {
        return $this === self::DistanceDuration || $this === self::Duration;
    }

    public function label(): string
    {
        return match ($this) {
            self::WeightReps => 'Weight and reps',
            self::RepsOnly => 'Reps',
            self::DistanceDuration => 'Distance and time',
            self::Duration => 'Time',
        };
    }
}
