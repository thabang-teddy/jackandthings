<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single set. Personal records, progressive overload and training volume are
 * all read from this table.
 *
 * Weight is grams, distance metres, duration seconds - integers, never floats,
 * the same call Budget makes with cents. `user_id` is carried directly so the
 * ownership scope is one hop, but it stays outside #[Fillable]: it is set
 * through the $user->workoutSets() relation.
 */
#[Fillable([
    'workout_session_id',
    'exercise_id',
    'position',
    'is_warmup',
    'reps',
    'weight_grams',
    'distance_metres',
    'duration_seconds',
    'rpe',
    'completed_at',
])]
class WorkoutSet extends Model
{
    use HasFactory, HasUuids;

    /**
     * The column has a database default, but a model that has just been
     * created and not reloaded does not carry it - so `$set->is_warmup` was
     * null rather than false on exactly the instance WorkoutRecords::isRecord()
     * is handed straight after a write. A set is not a warm-up unless it says
     * so, in memory as well as on disk.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'is_warmup' => false,
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'is_warmup' => 'boolean',
            'reps' => 'integer',
            'weight_grams' => 'integer',
            'distance_metres' => 'integer',
            'duration_seconds' => 'integer',
            'rpe' => 'integer',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(WorkoutSession::class, 'workout_session_id');
    }

    public function exercise(): BelongsTo
    {
        return $this->belongsTo(Exercise::class);
    }

    /**
     * Sets that count towards a record or towards volume. A warm-up is logged
     * so the session reads honestly, but it is never somebody's best.
     *
     * @param  Builder<WorkoutSet>  $query
     * @return Builder<WorkoutSet>
     */
    public function scopeCounting(Builder $query): Builder
    {
        return $query->where('is_warmup', false);
    }

    /**
     * Load moved by this set, in grams. Zero for anything without both a
     * weight and a rep count - volume is a strength measure and a 5km run
     * has no business contributing to it.
     */
    public function volumeGrams(): int
    {
        if ($this->weight_grams === null || $this->reps === null) {
            return 0;
        }

        return $this->weight_grams * $this->reps;
    }
}
