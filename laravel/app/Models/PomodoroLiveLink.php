<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The live link: the Pomodoro state that is running right now, stored so the
 * website and the phone can see each other's timer and stay in sync.
 *
 * One row per user, replaced each time the timer changes and deleted when it
 * stops. A running timer is still ephemeral by design - this row exists only
 * while a session is active.
 */
#[Fillable(['state'])]
class PomodoroLiveLink extends Model
{
    use HasFactory, HasUuids;

    protected $casts = [
        'state' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
