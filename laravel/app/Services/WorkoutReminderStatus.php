<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Models\WorkoutReminderSetting;
use Illuminate\Support\Carbon;

/**
 * Reminder state only. This class never sends anything: notification delivery
 * (Android push, web push, email) is deliberately not built yet - see
 * docs/PRD.md "Open decisions". Clients poll this state and decide locally
 * whether to raise their own notification.
 *
 * The reminder is now target-based rather than per-hour: the user sets a
 * target count and activity (e.g. 40 push-ups), a daily window (e.g. 5am to
 * 12pm), and the hours at which to check. The reminder is due when, at a
 * check hour inside the window, fewer than the target number of matching
 * workout entries have been logged since the window opened.
 *
 * Activity means any of three things since issue #4: a workout_entries row,
 * a set logged against a session, or a session finished. Counting only the
 * first would have nudged a user who had just finished a full tracked
 * workout, which is worse than not nudging at all.
 */
class WorkoutReminderStatus
{
    public function isDue(User $user): bool
    {
        $setting = $user->workoutReminderSetting;

        if ($setting === null || ! $setting->active) {
            return false;
        }

        $now = Carbon::now();

        if (! $setting->inWindow($now) || ! $setting->isCheckHour($now)) {
            return false;
        }

        $count = $this->countProgress($user, $setting, $now);

        return $count < $setting->target_count;
    }

    /**
     * The full progress picture: target, count so far, activity and window.
     * Clients render this as a progress line ("12 of 40 push-ups").
     */
    public function progress(User $user): array
    {
        $setting = $user->workoutReminderSetting;

        if ($setting === null || ! $setting->active) {
            return [
                'active' => false,
                'target' => null,
                'count' => 0,
                'activity' => null,
                'start_time' => null,
                'end_time' => null,
                'check_times' => [],
                'due' => false,
            ];
        }

        $now = Carbon::now();
        $count = $this->countProgress($user, $setting, $now);

        return [
            'active' => true,
            'target' => $setting->target_count,
            'count' => $count,
            'activity' => $setting->activity,
            'start_time' => $setting->start_time,
            'end_time' => $setting->end_time,
            'check_times' => $setting->check_times,
            'due' => $this->isDue($user),
        ];
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

    /**
     * Count matching entries, sets and finished sessions logged since the
     * window opened today, up to $now.
     */
    private function countProgress(User $user, WorkoutReminderSetting $setting, \DateTimeInterface $now): int
    {
        [$startHour, $startMinute] = array_map('intval', explode(':', $setting->start_time));
        $today = Carbon::parse($now)->startOfDay();
        $windowStart = $today->setTime($startHour, $startMinute);

        $count = 0;

        // Entries matching the activity (or any activity when none is set).
        $entryQuery = $user->workoutEntries()
            ->where('logged_at', '>=', $windowStart)
            ->where('logged_at', '<=', $now);
        if ($setting->activity !== null) {
            $entryQuery->where('activity', $setting->activity);
        }
        $count += $entryQuery->count();

        // Sets completed inside the window count too.
        $count += $user->workoutSets()
            ->where('completed_at', '>=', $windowStart)
            ->where('completed_at', '<=', $now)
            ->count();

        // Finished sessions count too.
        $count += $user->workoutSessions()
            ->whereNotNull('finished_at')
            ->where('finished_at', '>=', $windowStart)
            ->where('finished_at', '<=', $now)
            ->count();

        return $count;
    }
}
