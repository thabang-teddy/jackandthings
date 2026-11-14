<?php

declare(strict_types=1);

namespace Tests\Feature\Services;

use App\Models\Exercise;
use App\Models\User;
use App\Models\WorkoutSession;
use App\Services\WorkoutAnalytics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Training volume, streaks and the consistency calendar.
 *
 * The timezone behaviour is the point of most of these. The app runs in UTC,
 * and an evening workout in Johannesburg lands on the previous UTC day - so a
 * streak computed in the wrong zone tells the user they broke a run they did
 * not break.
 */
class WorkoutAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private WorkoutAnalytics $analytics;

    private User $user;

    private Exercise $exercise;

    protected function setUp(): void
    {
        parent::setUp();

        $this->analytics = app(WorkoutAnalytics::class);
        $this->user = User::factory()->create();
        $this->exercise = Exercise::factory()->catalog()->create();
    }

    public function test_volume_is_weight_times_reps(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 12:00:00'));

        $this->logSet(Carbon::parse('2026-11-14 10:00:00'), 60_000, 5);

        $this->assertSame(300_000, $this->analytics->for($this->user)['today']['volume_grams']);
    }

    public function test_warmups_count_towards_nothing(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 12:00:00'));

        $this->logSet(Carbon::parse('2026-11-14 10:00:00'), 200_000, 10, warmup: true);

        $today = $this->analytics->for($this->user)['today'];

        $this->assertSame(0, $today['sets']);
        $this->assertSame(0, $today['volume_grams']);
    }

    public function test_an_evening_set_is_bucketed_in_the_callers_zone(): void
    {
        // 22:30 in Johannesburg on the 14th is 20:30 UTC on the 14th - but
        // 00:30 UTC on the 15th would be 02:30 on the 15th in Johannesburg.
        // This set is the awkward one: late local evening, next UTC day.
        $this->travelTo(Carbon::parse('2026-11-14 23:00:00', 'Africa/Johannesburg'));

        $this->logSet(Carbon::parse('2026-11-14 22:30:00', 'Africa/Johannesburg'), 60_000, 5);

        $inZone = $this->analytics->for($this->user, 'Africa/Johannesburg');

        $this->assertSame(1, $inZone['today']['sets']);
        $this->assertSame('Africa/Johannesburg', $inZone['timezone']);
    }

    public function test_an_unknown_timezone_falls_back_rather_than_failing(): void
    {
        // A client sending junk should still get numbers, not an exception.
        $this->assertSame(
            config('app.timezone'),
            $this->analytics->for($this->user, 'Mars/Olympus_Mons')['timezone'],
        );
    }

    public function test_the_streak_counts_consecutive_trained_days(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 12:00:00'));

        foreach ([0, 1, 2] as $daysAgo) {
            $this->logSet(Carbon::parse('2026-11-14 10:00:00')->subDays($daysAgo), 60_000, 5);
        }

        $this->assertSame(3, $this->analytics->for($this->user)['streak_days']);
    }

    public function test_an_untrained_today_leaves_yesterdays_streak_standing(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 09:00:00'));

        $this->logSet(Carbon::parse('2026-11-13 18:00:00'), 60_000, 5);
        $this->logSet(Carbon::parse('2026-11-12 18:00:00'), 60_000, 5);

        // Today is still in progress. Zeroing a two-day streak at midnight,
        // before the user has had a chance to train, would be a lie.
        $this->assertSame(2, $this->analytics->for($this->user)['streak_days']);
    }

    public function test_a_gap_ends_the_streak(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 12:00:00'));

        $this->logSet(Carbon::parse('2026-11-14 10:00:00'), 60_000, 5);
        // Nothing on the 13th.
        $this->logSet(Carbon::parse('2026-11-12 10:00:00'), 60_000, 5);

        $this->assertSame(1, $this->analytics->for($this->user)['streak_days']);
    }

    public function test_the_longest_streak_survives_breaking_the_current_one(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 12:00:00'));

        foreach ([10, 9, 8, 7] as $daysAgo) {
            $this->logSet(Carbon::parse('2026-11-14 10:00:00')->subDays($daysAgo), 60_000, 5);
        }

        $this->logSet(Carbon::parse('2026-11-14 10:00:00'), 60_000, 5);

        $figures = $this->analytics->for($this->user);

        $this->assertSame(1, $figures['streak_days']);
        $this->assertSame(4, $figures['longest_streak_days']);
    }

    public function test_the_calendar_keeps_the_empty_days(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 12:00:00'));

        $this->logSet(Carbon::parse('2026-11-14 10:00:00'), 60_000, 5);

        $calendar = $this->analytics->for($this->user)['calendar'];

        // The gaps are the point of a consistency view: a calendar that
        // dropped untrained days would read as an unbroken streak.
        $this->assertCount(WorkoutAnalytics::HISTORY_DAYS, $calendar);
        $this->assertTrue($calendar[WorkoutAnalytics::HISTORY_DAYS - 1]['trained']);
        $this->assertFalse($calendar[0]['trained']);
    }

    public function test_the_day_chart_always_has_a_full_week(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 12:00:00'));

        $days = $this->analytics->for($this->user)['days'];

        $this->assertCount(WorkoutAnalytics::CHART_DAYS, $days);
        $this->assertSame('2026-11-14', $days[WorkoutAnalytics::CHART_DAYS - 1]['date']);
    }

    public function test_another_users_sets_are_never_counted(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 12:00:00'));

        $other = User::factory()->create();
        $session = WorkoutSession::factory()->for($other)->create();
        $other->workoutSets()->create([
            'workout_session_id' => $session->getKey(),
            'exercise_id' => $this->exercise->getKey(),
            'position' => 1,
            'weight_grams' => 100_000,
            'reps' => 10,
            'completed_at' => Carbon::parse('2026-11-14 10:00:00'),
        ]);

        $this->assertSame(0, $this->analytics->for($this->user)['today']['sets']);
    }

    /**
     * Writes a set at an absolute instant.
     *
     * The `->utc()` conversions are not decoration: Eloquent stores a Carbon's
     * wall-clock reading and drops its offset, so a value built in
     * Africa/Johannesburg would land in the database as that same clock time
     * labelled UTC - two hours adrift. WorkoutSetRequest does exactly this
     * conversion on the real path, and this helper has to match it or the
     * timezone assertions above would be testing a fiction.
     */
    private function logSet(Carbon $at, int $weightGrams, int $reps, bool $warmup = false): void
    {
        $instant = $at->copy()->utc();

        $session = WorkoutSession::factory()
            ->for($this->user)
            ->create([
                'started_at' => $instant,
                'finished_at' => $instant->copy()->addHour(),
            ]);

        $this->user->workoutSets()->create([
            'workout_session_id' => $session->getKey(),
            'exercise_id' => $this->exercise->getKey(),
            'position' => 1,
            'is_warmup' => $warmup,
            'weight_grams' => $weightGrams,
            'reps' => $reps,
            'completed_at' => $instant,
        ]);
    }
}
