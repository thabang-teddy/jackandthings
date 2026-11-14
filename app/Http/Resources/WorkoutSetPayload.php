<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\WorkoutSet;

/**
 * One logged set. Every measure is nullable - an exercise carries only the
 * ones its metric tracks - and null means "not measured", never zero.
 *
 * The exercise's name and metric ride along so a session's set list renders
 * without a lookup per row.
 */
final class WorkoutSetPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(WorkoutSet $set): array
    {
        return [
            'id' => $set->id,
            'workout_session_id' => $set->workout_session_id,
            'exercise_id' => $set->exercise_id,
            'exercise_name' => $set->exercise?->name,
            'metric' => $set->exercise?->metric->value,
            'position' => $set->position,
            'is_warmup' => $set->is_warmup,
            'reps' => $set->reps,
            'weight_grams' => $set->weight_grams,
            'distance_metres' => $set->distance_metres,
            'duration_seconds' => $set->duration_seconds,
            'rpe' => $set->rpe,
            'volume_grams' => $set->volumeGrams(),
            'completed_at' => $set->completed_at?->toIso8601String(),
        ];
    }

    /**
     * @param  iterable<WorkoutSet>  $sets
     * @return array<int, array<string, mixed>>
     */
    public static function collection(iterable $sets): array
    {
        $payload = [];
        foreach ($sets as $set) {
            $payload[] = self::from($set);
        }

        return $payload;
    }
}
