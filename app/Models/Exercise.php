<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ExerciseCategory;
use App\Enums\ExerciseMetric;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An exercise, either from the seeded catalog (`user_id` null) or one the user
 * wrote themselves.
 *
 * This is the only model in the application with unowned rows, so it is also
 * the only one whose policy has to answer "can anyone read this" rather than
 * just "is this yours". ExercisePolicy does that; `visibleTo()` below is the
 * query-side half of the same rule, and every list goes through it.
 */
#[Fillable([
    'name',
    'slug',
    'category',
    'primary_muscle',
    'equipment',
    'metric',
    'instructions',
    'cues',
])]
class Exercise extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'category' => ExerciseCategory::class,
            'metric' => ExerciseMetric::class,
            'cues' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * What stops an exercise being deleted. Both foreign keys are restrictive,
     * so these two relations are checked before a delete is attempted and the
     * refusal is reported as a validation error rather than a constraint
     * violation.
     */
    public function routineItems(): HasMany
    {
        return $this->hasMany(WorkoutRoutineItem::class);
    }

    public function sets(): HasMany
    {
        return $this->hasMany(WorkoutSet::class);
    }

    /**
     * The catalog plus this user's own exercises, and nobody else's.
     *
     * @param  Builder<Exercise>  $query
     * @return Builder<Exercise>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->where(
            fn (Builder $scoped) => $scoped
                ->whereNull('user_id')
                ->orWhere('user_id', $user->getKey())
        );
    }

    /** A seeded catalog row, which nobody may edit or delete. */
    public function isGlobal(): bool
    {
        return $this->user_id === null;
    }
}
