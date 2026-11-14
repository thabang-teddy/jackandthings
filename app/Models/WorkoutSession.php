<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One workout. Open while it runs, closed when `finished_at` is set.
 *
 * `routine_name` is denormalised on purpose, the way pomodoro_sessions keeps
 * `preset_name`: the history has to keep reading correctly after the routine
 * it came from is renamed or deleted.
 */
#[Fillable(['workout_routine_id', 'routine_name', 'started_at', 'finished_at', 'notes'])]
class WorkoutSession extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function routine(): BelongsTo
    {
        return $this->belongsTo(WorkoutRoutine::class, 'workout_routine_id');
    }

    public function sets(): HasMany
    {
        return $this->hasMany(WorkoutSet::class)->orderBy('position');
    }

    /** Still running - no `finished_at` yet. */
    public function isOpen(): bool
    {
        return $this->finished_at === null;
    }

    /**
     * @param  Builder<WorkoutSession>  $query
     * @return Builder<WorkoutSession>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereNull('finished_at');
    }
}
