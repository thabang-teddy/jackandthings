<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\PomodoroSession;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The daily and weekly figures issue #3 asks for, read off pomodoro_sessions.
 *
 * Everything is bucketed in the *caller's* timezone, not the app's. The app
 * runs in UTC (config/app.php), and "total focus hours today" or "your most
 * productive time of day" computed in UTC is simply wrong for anybody not
 * living there - an 8pm session in Johannesburg would land on the previous
 * UTC day and in the 18:00 bucket. Each client passes its own IANA zone;
 * REQUEST_TIMEZONE_RULE is the validation every entry point applies to it.
 *
 * Rows are fetched once and bucketed in PHP rather than run as half a dozen
 * grouped queries with driver-specific timezone conversion: SQLite and MySQL
 * disagree about that, this is a single-user data set measured in thousands
 * of rows, and one pass keeps the buckets guaranteed consistent with each
 * other.
 */
class PomodoroAnalytics
{
    /** Days of history the hour-of-day histogram and the streak look back over. */
    public const HISTORY_DAYS = 90;

    /** Days shown in the day-by-day chart. */
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

        $sessions = $this->recentSessions($user, $zone, $now);
        $focus = $sessions->filter(fn (array $row): bool => $row['phase']->isFocus());

        $todayKey = $now->toDateString();
        $weekStart = $now->copy()->startOfWeek();

        return [
            'timezone' => $zone,
            'week_starts_on' => $weekStart->toDateString(),
            'today' => $this->totals($focus->filter(fn (array $r): bool => $r['date'] === $todayKey)),
            'week' => $this->totals($focus->filter(fn (array $r): bool => $r['at']->greaterThanOrEqualTo($weekStart))),
            'history' => $this->totals($focus),
            'break_seconds_today' => (int) $sessions
                ->filter(fn (array $r): bool => ! $r['phase']->isFocus() && $r['date'] === $todayKey)
                ->sum('duration_seconds'),
            'days' => $this->byDay($focus, $now),
            'hours' => $this->byHour($focus),
            'tags' => $this->byTag($focus),
            'most_productive_hour' => $this->mostProductiveHour($focus),
            'streak_days' => $this->streakDays($focus, $now),
            'completion_rate' => $this->completionRate($focus),
            'history_days' => self::HISTORY_DAYS,
        ];
    }

    /**
     * The window every bucket below is built from: finished intervals inside
     * HISTORY_DAYS, already converted into the caller's zone so no consumer
     * has to repeat that conversion.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function recentSessions(User $user, string $zone, Carbon $now): Collection
    {
        $since = $now->copy()->subDays(self::HISTORY_DAYS - 1)->startOfDay()->utc();

        return $user->pomodoroSessions()
            ->where('started_at', '>=', $since)
            ->orderBy('started_at')
            ->get(['phase', 'tag', 'started_at', 'duration_seconds', 'completed'])
            ->map(function (PomodoroSession $session) use ($zone): array {
                $at = $session->started_at->copy()->setTimezone($zone);

                return [
                    'at' => $at,
                    'date' => $at->toDateString(),
                    'hour' => (int) $at->format('G'),
                    'phase' => $session->phase,
                    'tag' => $session->tag,
                    'duration_seconds' => $session->duration_seconds,
                    'completed' => $session->completed,
                ];
            });
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $focus
     * @return array{focus_seconds: int, intervals: int}
     */
    private function totals(Collection $focus): array
    {
        return [
            'focus_seconds' => (int) $focus->sum('duration_seconds'),
            // "Completed intervals" means intervals that ran to the end; a
            // session stopped halfway still contributes its seconds above.
            'intervals' => $focus->where('completed', true)->count(),
        ];
    }

    /**
     * CHART_DAYS buckets ending today, including the days with nothing in
     * them - a chart that silently drops empty days misreads as a streak.
     *
     * @param  Collection<int, array<string, mixed>>  $focus
     * @return array<int, array<string, mixed>>
     */
    private function byDay(Collection $focus, Carbon $now): array
    {
        $grouped = $focus->groupBy('date');

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
     * @param  Collection<int, array<string, mixed>>  $focus
     * @return array<int, array<string, mixed>>
     */
    private function byHour(Collection $focus): array
    {
        $grouped = $focus->groupBy('hour');

        return array_map(fn (int $hour): array => [
            'hour' => $hour,
            ...$this->totals($grouped->get($hour, collect())),
        ], range(0, 23));
    }

    /**
     * Untagged sessions are grouped under a null tag rather than dropped, so
     * the tag breakdown still adds up to the totals above.
     *
     * @param  Collection<int, array<string, mixed>>  $focus
     * @return array<int, array<string, mixed>>
     */
    private function byTag(Collection $focus): array
    {
        return $focus
            ->groupBy(fn (array $row): string => $row['tag'] ?? '')
            ->map(fn (Collection $rows, string $tag): array => [
                'tag' => $tag === '' ? null : $tag,
                ...$this->totals($rows),
            ])
            ->sortByDesc('focus_seconds')
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $focus
     */
    private function mostProductiveHour(Collection $focus): ?int
    {
        if ($focus->isEmpty()) {
            return null;
        }

        $totals = $focus->groupBy('hour')->map(fn (Collection $rows): int => (int) $rows->sum('duration_seconds'));

        return $totals->isEmpty() ? null : (int) $totals->sortDesc()->keys()->first();
    }

    /**
     * Consecutive days up to and including today with at least one focus
     * interval. A day with nothing on it ends the streak - except today,
     * which is still in progress, so an unused today leaves yesterday's
     * streak standing rather than zeroing it before the day is over.
     *
     * @param  Collection<int, array<string, mixed>>  $focus
     */
    private function streakDays(Collection $focus, Carbon $now): int
    {
        $active = $focus->pluck('date')->unique()->all();
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
     * Share of started focus intervals that ran to the end, as a percentage.
     * Null rather than 0 when nothing has been started: no data is not the
     * same as never finishing anything.
     *
     * @param  Collection<int, array<string, mixed>>  $focus
     */
    private function completionRate(Collection $focus): ?float
    {
        $started = $focus->count();
        if ($started === 0) {
            return null;
        }

        return round($focus->where('completed', true)->count() / $started * 100, 1);
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
