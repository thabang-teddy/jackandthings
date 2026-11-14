<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\WorkoutRoutine;
use App\Models\WorkoutRoutineItem;

/**
 * A routine with its items in order. Each item carries its exercise's name and
 * metric inline so a client can draw the routine - and decide which inputs a
 * set needs - without a second request per exercise.
 */
final class WorkoutRoutinePayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(WorkoutRoutine $routine): array
    {
        return [
            'id' => $routine->id,
            'name' => $routine->name,
            'notes' => $routine->notes,
            'created_at' => $routine->created_at?->toIso8601String(),
            'items' => $routine->items
                ->map(fn (WorkoutRoutineItem $item): array => self::item($item))
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function item(WorkoutRoutineItem $item): array
    {
        return [
            'id' => $item->id,
            'exercise_id' => $item->exercise_id,
            'exercise_name' => $item->exercise?->name,
            'category' => $item->exercise?->category->value,
            'metric' => $item->exercise?->metric->value,
            'position' => $item->position,
            'target_sets' => $item->target_sets,
            'target_reps' => $item->target_reps,
            'target_weight_grams' => $item->target_weight_grams,
            'target_distance_metres' => $item->target_distance_metres,
            'target_duration_seconds' => $item->target_duration_seconds,
            'rest_seconds' => $item->rest_seconds,
        ];
    }

    /**
     * @param  iterable<WorkoutRoutine>  $routines
     * @return array<int, array<string, mixed>>
     */
    public static function collection(iterable $routines): array
    {
        $payload = [];
        foreach ($routines as $routine) {
            $payload[] = self::from($routine);
        }

        return $payload;
    }
}
