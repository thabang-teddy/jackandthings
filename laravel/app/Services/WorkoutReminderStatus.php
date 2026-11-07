<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Reminder state only. This class never sends anything: notification delivery
 * (Android push, web push, email) is deliberately not built yet — see
 * docs/PRD.md "Open decisions". Clients poll this state and decide locally
 * whether to raise their own notification.
 */
class WorkoutReminderStatus
{
    public function isDue(User $user): bool
    {
        return ! $user->workoutEntries()
            ->where('logged_at', '>=', Carbon::now()->startOfHour())
            ->exists();
    }

    public function lastLoggedAt(User $user): ?Carbon
    {
        /** @var Carbon|null $loggedAt */
        $loggedAt = $user->workoutEntries()->max('logged_at');

        return $loggedAt === null ? null : Carbon::parse($loggedAt);
    }
}
