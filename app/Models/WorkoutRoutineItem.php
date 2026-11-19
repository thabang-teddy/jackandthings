<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One exercise's slot in a routine. Reached only through its routine, which is
 * what a policy guards - hence no user_id and no policy of its own.
 *
 * Which targets mean anything depends on the exercise's metric; the rest stay
 * null. See App\Enums\ExerciseMetric.
 */
#[Fillable([
    'exercise_id',
    'position',
    'target_sets',
    'target_reps',
    'target_weight_grams',
    'target_distance_metres',
    'target_duration_seconds',
    'rest_seconds',
])]
class WorkoutRoutineItem extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'target_sets' => 'integer',
            'target_reps' => 'integer',
            'target_weight_grams' => 'integer',
            'target_distance_metres' => 'integer',
            'target_duration_seconds' => 'integer',
            'rest_seconds' => 'integer',
        ];
    }

    public function routine(): BelongsTo
    {
        return $this->belongsTo(WorkoutRoutine::class, 'workout_routine_id');
    }

    public function exercise(): BelongsTo
    {
        return $this->belongsTo(Exercise::class);
    }
}
