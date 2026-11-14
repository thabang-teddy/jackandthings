<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\PomodoroPhase;
use App\Models\PomodoroSession;
use App\Models\User;
use App\Services\PomodoroAnalytics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The focus analytics, which is where this module keeps almost all of its
 * arithmetic.
 *
 * The timezone cases carry the most weight. The app runs in UTC
 * (config/app.php) and these figures are bucketed in whatever zone the caller
 * names, so "an evening session in Johannesburg lands on today, not
 * yesterday" is the property the whole feature rests on - and the one that
 * looks correct on a developer machine sitting in UTC+2 whether or not the
 * conversion is actually there.
 */
class PomodoroAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private const JOHANNESBURG = 'Africa/Johannesburg';

    private PomodoroAnalytics $analytics;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->analytics = app(PomodoroAnalytics::class);
        $this->user = User::factory()->create();

        // Midday on a Friday, so UTC and +02:00 agree on the date and the
        // fixtures below read as the day they are written as. The cases that
        // turn on the two zones disagreeing set their own clock.
        Carbon::setTestNow(Carbon::parse('2026-11-13 10:00:00', 'UTC'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Logs a finished focus interval at an absolute UTC instant. */
    private function focusAt(string $utc, int $minutes = 25, array $overrides = []): PomodoroSession
    {
        $startedAt = Carbon::parse($utc, 'UTC');

        return $this->user->pomodoroSessions()->create([
            'preset_name' => 'Classic 25/5',
            'phase' => PomodoroPhase::Focus,
            'started_at' => $startedAt,
            'ended_at' => $startedAt->copy()->addMinutes($minutes),
            'duration_seconds' => $minutes * 60,
            'completed' => true,
            ...$overrides,
        ]);
    }

    // ── Timezone ──────────────────────────────────────────────────────────

    public function test_an_evening_session_counts_towards_the_callers_today_not_utcs(): void
    {
        // 23:30 in Johannesburg on the 13th is 21:30 UTC on the 13th. Both
        // agree here, so this one is the control for the case below.
        $this->focusAt('2026-11-13 21:30:00');

        $local = $this->analytics->for($this->user, self::JOHANNESBURG);

        $this->assertSame(1500, $local['today']['focus_seconds']);
    }

    public function test_a_late_session_is_filed_under_the_callers_day_not_utcs(): void
    {
        // The whole reason this service takes a timezone. 22:30 UTC on the
        // 13th is 00:30 on the 14th in Johannesburg: the same instant, filed
        // under a different day depending on who is asking. Bucketing in the
        // app's UTC would put somebody's Friday-night session on Friday when
        // for them it was already Saturday.
        Carbon::setTestNow(Carbon::parse('2026-11-13 23:00:00', 'UTC'));
        $this->focusAt('2026-11-13 22:30:00');

        $utc = $this->analytics->for($this->user, 'UTC');
        $local = $this->analytics->for($this->user, self::JOHANNESBURG);

        // Both call it "today", because for each of them it is.
        $this->assertSame(1500, $utc['today']['focus_seconds']);
        $this->assertSame(1500, $local['today']['focus_seconds']);

        // The day it is filed under is what differs, and that is the point.
        $this->assertSame('2026-11-13', $utc['days'][6]['date']);
        $this->assertSame('2026-11-14', $local['days'][6]['date']);
    }

    public function test_the_hour_bucket_is_the_callers_local_hour(): void
    {
        // 06:00 UTC is 08:00 in Johannesburg.
        $this->focusAt('2026-11-13 06:00:00');

        $this->assertSame(6, $this->analytics->for($this->user, 'UTC')['most_productive_hour']);
        $this->assertSame(8, $this->analytics->for($this->user, self::JOHANNESBURG)['most_productive_hour']);
    }

    public function test_an_unknown_timezone_falls_back_to_the_app_zone_rather_than_failing(): void
    {
        $this->focusAt('2026-11-13 06:00:00');

        $result = $this->analytics->for($this->user, 'Mars/Olympus_Mons');

        $this->assertSame(config('app.timezone'), $result['timezone']);
    }

    public function test_no_timezone_at_all_falls_back_to_the_app_zone(): void
    {
        $this->assertSame(config('app.timezone'), $this->analytics->for($this->user)['timezone']);
        $this->assertSame(config('app.timezone'), $this->analytics->for($this->user, '')['timezone']);
    }

    // ── Totals ────────────────────────────────────────────────────────────

    public function test_breaks_are_excluded_from_focus_totals_but_counted_on_their_own(): void
    {
        $this->focusAt('2026-11-13 10:00:00', 25);
        $this->focusAt('2026-11-13 11:00:00', 5, ['phase' => PomodoroPhase::ShortBreak]);
        $this->focusAt('2026-11-13 12:00:00', 20, ['phase' => PomodoroPhase::LongBreak]);

        $result = $this->analytics->for($this->user, self::JOHANNESBURG);

        $this->assertSame(1500, $result['today']['focus_seconds']);
        $this->assertSame(1, $result['today']['intervals']);
        $this->assertSame(25 * 60, $result['break_seconds_today']);
    }

    public function test_an_abandoned_interval_still_contributes_its_seconds_but_is_not_a_completed_interval(): void
    {
        $this->focusAt('2026-11-13 10:00:00', 25);
        $this->focusAt('2026-11-13 11:00:00', 10, ['completed' => false]);

        $result = $this->analytics->for($this->user, self::JOHANNESBURG);

        $this->assertSame(35 * 60, $result['today']['focus_seconds']);
        $this->assertSame(1, $result['today']['intervals']);
    }

    public function test_another_users_sessions_are_never_counted(): void
    {
        $stranger = User::factory()->create();
        $stranger->pomodoroSessions()->create([
            'preset_name' => 'Theirs',
            'phase' => PomodoroPhase::Focus,
            'started_at' => Carbon::parse('2026-11-13 10:00:00', 'UTC'),
            'ended_at' => Carbon::parse('2026-11-13 10:25:00', 'UTC'),
            'duration_seconds' => 1500,
        ]);

        $this->assertSame(0, $this->analytics->for($this->user, self::JOHANNESBURG)['today']['focus_seconds']);
    }

    // ── Buckets ───────────────────────────────────────────────────────────

    public function test_the_day_chart_keeps_empty_days_rather_than_dropping_them(): void
    {
        $this->focusAt('2026-11-13 10:00:00');

        $days = $this->analytics->for($this->user, self::JOHANNESBURG)['days'];

        // A chart that silently omitted empty days would misread as a streak.
        $this->assertCount(PomodoroAnalytics::CHART_DAYS, $days);
        $this->assertSame(0, $days[0]['focus_seconds']);
        $this->assertSame(1500, $days[6]['focus_seconds']);
    }

    public function test_the_hour_histogram_always_has_all_twenty_four_buckets(): void
    {
        $hours = $this->analytics->for($this->user, self::JOHANNESBURG)['hours'];

        $this->assertCount(24, $hours);
        $this->assertSame(range(0, 23), array_column($hours, 'hour'));
    }

    public function test_untagged_sessions_are_grouped_rather_than_dropped(): void
    {
        $this->focusAt('2026-11-13 09:00:00', 25, ['tag' => 'Coding']);
        $this->focusAt('2026-11-13 10:00:00', 50, ['tag' => null]);

        $tags = $this->analytics->for($this->user, self::JOHANNESBURG)['tags'];

        // Sorted by time spent, so untagged leads here, and the two together
        // add up to the overall total.
        $this->assertNull($tags[0]['tag']);
        $this->assertSame(3000, $tags[0]['focus_seconds']);
        $this->assertSame('Coding', $tags[1]['tag']);
        $this->assertSame(
            array_sum(array_column($tags, 'focus_seconds')),
            $this->analytics->for($this->user, self::JOHANNESBURG)['history']['focus_seconds'],
        );
    }

    public function test_the_most_productive_hour_is_the_one_with_the_most_time_not_the_most_sessions(): void
    {
        // Three short runs in one hour against one long run in another: the
        // long one wins, which is what "most productive" has to mean.
        $this->focusAt('2026-11-13 07:00:00', 5);
        $this->focusAt('2026-11-13 07:20:00', 5);
        $this->focusAt('2026-11-13 07:40:00', 5);
        $this->focusAt('2026-11-13 09:00:00', 50);

        $this->assertSame(11, $this->analytics->for($this->user, self::JOHANNESBURG)['most_productive_hour']);
    }

    public function test_there_is_no_most_productive_hour_without_any_sessions(): void
    {
        $this->assertNull($this->analytics->for($this->user, self::JOHANNESBURG)['most_productive_hour']);
    }

    // ── Streak ────────────────────────────────────────────────────────────

    public function test_consecutive_days_build_a_streak(): void
    {
        $this->focusAt('2026-11-11 09:00:00');
        $this->focusAt('2026-11-12 09:00:00');
        $this->focusAt('2026-11-13 09:00:00');

        $this->assertSame(3, $this->analytics->for($this->user, self::JOHANNESBURG)['streak_days']);
    }

    public function test_a_gap_ends_the_streak(): void
    {
        $this->focusAt('2026-11-10 09:00:00');
        // Nothing on the 11th.
        $this->focusAt('2026-11-12 09:00:00');
        $this->focusAt('2026-11-13 09:00:00');

        $this->assertSame(2, $this->analytics->for($this->user, self::JOHANNESBURG)['streak_days']);
    }

    public function test_a_day_that_is_still_in_progress_does_not_break_yesterdays_streak(): void
    {
        // Nothing today yet. Zeroing the streak before the day is over would
        // punish somebody for checking their stats in the morning.
        $this->focusAt('2026-11-11 09:00:00');
        $this->focusAt('2026-11-12 09:00:00');

        $this->assertSame(2, $this->analytics->for($this->user, self::JOHANNESBURG)['streak_days']);
    }

    public function test_the_streak_is_zero_with_nothing_logged_at_all(): void
    {
        $this->assertSame(0, $this->analytics->for($this->user, self::JOHANNESBURG)['streak_days']);
    }

    // ── Completion rate ───────────────────────────────────────────────────

    public function test_the_completion_rate_is_null_rather_than_zero_when_nothing_was_started(): void
    {
        // No data is not the same as never finishing anything, and a screen
        // reading "0% completed" to somebody who has not started yet is wrong.
        $this->assertNull($this->analytics->for($this->user, self::JOHANNESBURG)['completion_rate']);
    }

    public function test_the_completion_rate_counts_finished_against_started(): void
    {
        $this->focusAt('2026-11-13 08:00:00');
        $this->focusAt('2026-11-13 09:00:00');
        $this->focusAt('2026-11-13 10:00:00');
        $this->focusAt('2026-11-13 11:00:00', 10, ['completed' => false]);

        $this->assertSame(75.0, $this->analytics->for($this->user, self::JOHANNESBURG)['completion_rate']);
    }

    // ── Window ────────────────────────────────────────────────────────────

    public function test_sessions_older_than_the_history_window_are_not_counted(): void
    {
        $this->focusAt('2026-11-13 09:00:00');
        $this->focusAt(
            Carbon::parse('2026-11-13 09:00:00', 'UTC')
                ->subDays(PomodoroAnalytics::HISTORY_DAYS + 1)
                ->toDateTimeString()
        );

        $result = $this->analytics->for($this->user, self::JOHANNESBURG);

        $this->assertSame(1500, $result['history']['focus_seconds']);
    }
}
