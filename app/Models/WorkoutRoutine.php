<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A saved workout template. `user_id` is outside #[Fillable]: it is set
 * through the $user->workoutRoutines() relation, so a request cannot choose
 * an owner.
 */
#[Fillable(['name', 'notes'])]
class WorkoutRoutine extends Model
{
    use HasFactory, HasUuids;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** In the order the user arranged them. */
    public function items(): HasMany
    {
        return $this->hasMany(WorkoutRoutineItem::class)->orderBy('position');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(WorkoutSession::class);
    }
}
