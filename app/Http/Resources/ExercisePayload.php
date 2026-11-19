<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Exercise;

/**
 * The wire shape of an exercise, spelled out field by field rather than
 * serialising the model, so adding a column never silently widens the API.
 *
 * `is_custom` is derived rather than exposing `user_id`: a client only needs
 * to know whether it may offer an edit button, not who owns the row.
 */
final class ExercisePayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(Exercise $exercise): array
    {
        return [
            'id' => $exercise->id,
            'name' => $exercise->name,
            'slug' => $exercise->slug,
            'category' => $exercise->category->value,
            'category_label' => $exercise->category->label(),
            'metric' => $exercise->metric->value,
            'metric_label' => $exercise->metric->label(),
            'primary_muscle' => $exercise->primary_muscle,
            'equipment' => $exercise->equipment,
            'instructions' => $exercise->instructions,
            'cues' => $exercise->cues ?? [],
            'is_custom' => ! $exercise->isGlobal(),
        ];
    }

    /**
     * @param  iterable<Exercise>  $exercises
     * @return array<int, array<string, mixed>>
     */
    public static function collection(iterable $exercises): array
    {
        $payload = [];
        foreach ($exercises as $exercise) {
            $payload[] = self::from($exercise);
        }

        return $payload;
    }
}
