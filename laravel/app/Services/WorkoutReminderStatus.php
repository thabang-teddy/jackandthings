<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Reminder state only. This class never sends anything: notification delivery
 * (Android push, web push, email) is deliberately not built yet - see
 * docs/PRD.md "Open decisions". Clients poll this state and decide locally
 * whether to raise their own notification.
 *
 * Activity means any of three things since issue #4, not just the one-line
 * entry log: a workout_entries row, a set logged against a session, or a
 * session finished. Counting only the first would have nudged a user who had
 * just finished a full tracked workout, which is worse than not nudging at
 * all - the reminder would be telling them something they know to be false.
 */
class WorkoutReminderStatus
{
    public function isDue(User $user): bool
    {
        $since = Carbon::now()->startOfHour();

        if ($user->workoutEntries()->where('logged_at', '>=', $since)->exists()) {
            return false;
        }

        if ($user->workoutSets()->where('completed_at', '>=', $since)->exists()) {
            return false;
        }

        if ($user->workoutSessions()->where('finished_at', '>=', $since)->exists()) {
            return false;
        }

        // An open session counts too: a workout in progress is the clearest
        // possible answer to "have you trained this hour".
        return ! $user->workoutSessions()
            ->open()
            ->where('started_at', '>=', $since)
            ->exists();
    }

    /**
     * The most recent moment the user did anything, across all three sources.
     * Null only if they have never logged anything at all.
     */
    public function lastLoggedAt(User $user): ?Carbon
    {
        $candidates = array_filter([
            $user->workoutEntries()->max('logged_at'),
            $user->workoutSets()->max('completed_at'),
            $user->workoutSessions()->max('finished_at'),
            $user->workoutSessions()->max('started_at'),
        ]);

        if ($candidates === []) {
            return null;
        }

        return collect($candidates)
            ->map(fn (string $value): Carbon => Carbon::parse($value))
            ->sortDesc()
            ->first();
    }
}
