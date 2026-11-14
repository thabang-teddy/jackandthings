<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PomodoroPhase;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One finished Pomodoro interval. Written by whichever client watched the
 * interval end; see the create_pomodoro_sessions_table migration for why a
 * running timer is still not persisted and why `preset_name` is denormalised.
 *
 * `user_id` is deliberately outside #[Fillable]: it is set through the
 * `$user->pomodoroSessions()` relation so a request can never choose an owner.
 */
#[Fillable([
    'pomodoro_preset_id',
    'preset_name',
    'tag',
    'phase',
    'started_at',
    'ended_at',
    'duration_seconds',
    'completed',
    'source',
])]
class PomodoroSession extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'phase' => PomodoroPhase::class,
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'duration_seconds' => 'integer',
            'completed' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function preset(): BelongsTo
    {
        return $this->belongsTo(PomodoroPreset::class, 'pomodoro_preset_id');
    }
}
