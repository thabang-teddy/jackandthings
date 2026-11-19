<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A user's workout reminder target: how many of an activity to hit, and at
 * which times inside a daily window the reminder checks progress.
 *
 * Replaces the old "nothing logged this hour" nudge with a target the user
 * works toward across the day.
 */
#[Fillable(['target_count', 'activity', 'start_time', 'end_time', 'check_times', 'active'])]
class WorkoutReminderSetting extends Model
{
    use HasFactory, HasUuids;

    protected $casts = [
        'check_times' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Is the current time inside the reminder window? */
    public function inWindow(\DateTimeInterface $now): bool
    {
        $time = $now->format('H:i');

        return $time >= $this->start_time && $time <= $this->end_time;
    }

    /** Is the current hour one of the check times? */
    public function isCheckHour(\DateTimeInterface $now): bool
    {
        return in_array((int) $now->format('G'), (array) $this->check_times);
    }
}
