<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Models\WorkoutSet;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Training volume, consistency and the workout calendar.
 *
 * Bucketed in the *caller's* timezone for the same reason PomodoroAnalytics
 * is: the app runs in UTC, and "did I train today" computed in UTC is simply
 * wrong for anybody not living there - an evening session in Johannesburg
 * lands on the previous UTC day. Each client passes its own IANA zone, and
 * REQUEST_TIMEZONE_RULE is the validation every entry point applies to it.
 *
 * "Trained on a day" means a finished session or at least one logged set, not
 * a one-line workout_entries row: the entry log is a different, lighter
 * feature and counting it here would make the streak claim strength training
 * the user never did. The streak the *reminder* cares about is a separate
 * question, answered by WorkoutReminderStatus.
 */
class WorkoutAnalytics
{
    /** Days the calendar and the streak look back over. */
    public const HISTORY_DAYS = 90;

    /** Days shown in the volume chart. */
    public const CHART_DAYS = 7;

    /** Validation every caller applies to a client-supplied timezone. */
    public const REQUEST_TIMEZONE_RULE = ['sometimes', 'nullable', 'string', 'timezone'];

    /**
     * @return array<string, mixed>
     */
    public function for(User $user, ?string $timezone = null): array
    {
        $zone = $this->resolveZone($timezone);
        $now = Carbon::now($zone);

        $sets = $this->recentSets($user, $zone, $now);

        $todayKey = $now->toDateString();
        $weekStart = $now->copy()->startOfWeek();

        return [
            'timezone' => $zone,
            'week_starts_on' => $weekStart->toDateString(),
            'today' => $this->totals($sets->filter(fn (array $row): bool => $row['date'] === $todayKey)),
            'week' => $this->totals($sets->filter(fn (array $row): bool => $row['at']->greaterThanOrEqualTo($weekStart))),
            'history' => $this->totals($sets),
            'days' => $this->byDay($sets, $now),
            'categories' => $this->byCategory($sets),
            'calendar' => $this->calendar($sets, $now),
            'streak_days' => $this->streakDays($sets, $now),
            'longest_streak_days' => $this->longestStreak($sets),
            'sessions_this_week' => $sets
                ->filter(fn (array $row): bool => $row['at']->greaterThanOrEqualTo($weekStart))
                ->pluck('session_id')
                ->unique()
                ->count(),
            'history_days' => self::HISTORY_DAYS,
            'chart_days' => self::CHART_DAYS,
        ];
    }

    /**
     * The window every bucket is built from: counting sets inside
     * HISTORY_DAYS, already converted into the caller's zone so no consumer
     * has to repeat that conversion.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function recentSets(User $user, string $zone, Carbon $now): Collection
    {
        $since = $now->copy()->subDays(self::HISTORY_DAYS - 1)->startOfDay()->utc();

        return $user->workoutSets()
            ->counting()
            ->where('completed_at', '>=', $since)
            ->with('exercise:id,category')
            ->orderBy('completed_at')
            ->get()
            ->map(function (WorkoutSet $set) use ($zone): array {
                $at = $set->completed_at->copy()->setTimezone($zone);

                return [
                    'at' => $at,
                    'date' => $at->toDateString(),
                    'session_id' => $set->workout_session_id,
                    'category' => $set->exercise?->category->value,
                    'volume_grams' => $set->volumeGrams(),
                    'reps' => $set->reps ?? 0,
                    'distance_metres' => $set->distance_metres ?? 0,
                    'duration_seconds' => $set->duration_seconds ?? 0,
                ];
            });
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $sets
     * @return array<string, int>
     */
    private function totals(Collection $sets): array
    {
        return [
            'sets' => $sets->count(),
            'volume_grams' => (int) $sets->sum('volume_grams'),
            'reps' => (int) $sets->sum('reps'),
            'distance_metres' => (int) $sets->sum('distance_metres'),
            'duration_seconds' => (int) $sets->sum('duration_seconds'),
            'sessions' => $sets->pluck('session_id')->unique()->count(),
        ];
    }

    /**
     * CHART_DAYS buckets ending today, including the days with nothing in
     * them - a chart that silently drops empty days misreads as a streak.
     *
     * @param  Collection<int, array<string, mixed>>  $sets
     * @return array<int, array<string, mixed>>
     */
    private function byDay(Collection $sets, Carbon $now): array
    {
        $grouped = $sets->groupBy('date');

        $days = [];
        for ($offset = self::CHART_DAYS - 1; $offset >= 0; $offset--) {
            $day = $now->copy()->subDays($offset);
            $rows = $grouped->get($day->toDateString(), collect());

            $days[] = [
                'date' => $day->toDateString(),
                'label' => $day->format('D'),
                ...$this->totals($rows),
            ];
        }

        return $days;
    }

    /**
     * Where the training went, by exercise category. Sets whose exercise has
     * since been deleted group under a null category rather than vanishing,
     * so the breakdown still adds up to the totals.
     *
     * @param  Collection<int, array<string, mixed>>  $sets
     * @return array<int, array<string, mixed>>
     */
    private function byCategory(Collection $sets): array
    {
        return $sets
            ->groupBy(fn (array $row): string => $row['category'] ?? '')
            ->map(fn (Collection $rows, string $category): array => [
                'category' => $category === '' ? null : $category,
                ...$this->totals($rows),
            ])
            ->sortByDesc('sets')
            ->values()
            ->all();
    }

    /**
     * One entry per day over HISTORY_DAYS, oldest first - the consistency
     * calendar. Days with nothing on them are present and marked untrained,
     * because the gaps are the point of a consistency view.
     *
     * @param  Collection<int, array<string, mixed>>  $sets
     * @return array<int, array<string, mixed>>
     */
    private function calendar(Collection $sets, Carbon $now): array
    {
        $grouped = $sets->groupBy('date');

        $days = [];
        for ($offset = self::HISTORY_DAYS - 1; $offset >= 0; $offset--) {
            $day = $now->copy()->subDays($offset);
            $key = $day->toDateString();
            $rows = $grouped->get($key, collect());

            $days[] = [
                'date' => $key,
                'trained' => $rows->isNotEmpty(),
                'sets' => $rows->count(),
                'volume_grams' => (int) $rows->sum('volume_grams'),
            ];
        }

        return $days;
    }

    /**
     * Consecutive days up to and including today with at least one set. A day
     * with nothing on it ends the streak - except today, which is still in
     * progress, so an untrained today leaves yesterday's streak standing
     * rather than zeroing it before the day is over.
     *
     * @param  Collection<int, array<string, mixed>>  $sets
     */
    private function streakDays(Collection $sets, Carbon $now): int
    {
        $active = $sets->pluck('date')->unique()->all();
        if ($active === []) {
            return 0;
        }

        $active = array_flip($active);
        $cursor = $now->copy();

        if (! isset($active[$cursor->toDateString()])) {
            $cursor->subDay();
        }

        $streak = 0;
        while (isset($active[$cursor->toDateString()]) && $streak < self::HISTORY_DAYS) {
            $streak++;
            $cursor->subDay();
        }

        return $streak;
    }

    /**
     * The best run of consecutive trained days inside the window. Reported
     * separately from the current streak so breaking one does not erase the
     * record of having held it.
     *
     * @param  Collection<int, array<string, mixed>>  $sets
     */
    private function longestStreak(Collection $sets): int
    {
        $dates = $sets->pluck('date')->unique()->sort()->values();
        if ($dates->isEmpty()) {
            return 0;
        }

        $longest = 1;
        $run = 1;
        $previous = Carbon::parse($dates->first());

        foreach ($dates->skip(1) as $date) {
            $current = Carbon::parse($date);
            $run = $previous->copy()->addDay()->toDateString() === $current->toDateString() ? $run + 1 : 1;
            $longest = max($longest, $run);
            $previous = $current;
        }

        return $longest;
    }

    /** Falls back to the app zone when a client sends nothing or sends junk. */
    private function resolveZone(?string $timezone): string
    {
        if ($timezone === null || $timezone === '') {
            return config('app.timezone');
        }

        return in_array($timezone, timezone_identifiers_list(), true)
            ? $timezone
            : config('app.timezone');
    }
}
