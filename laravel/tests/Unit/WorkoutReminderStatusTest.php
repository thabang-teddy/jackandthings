<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\User;
use App\Models\WorkoutReminderSetting;
use App\Services\WorkoutReminderStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The reminder is now target-based rather than per-hour: the user sets a
 * target count and activity (e.g. 40 push-ups), a daily window (e.g. 5am to
 * 12pm), and the hours at which to check. The reminder is due when, at a
 * check hour inside the window, fewer than the target number of matching
 * workout entries have been logged since the window opened.
 *
 * The server sends nothing itself: Android and the browser add-on poll this
 * and decide whether to raise a notification.
 */
class WorkoutReminderStatusTest extends TestCase
{
    use RefreshDatabase;

    private WorkoutReminderStatus $status;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->status = app(WorkoutReminderStatus::class);
        $this->user = User::factory()->create();
        Carbon::setTestNow(Carbon::parse('2026-11-07 11:30:00'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function setTarget(
        int $targetCount = 40,
        string $activity = 'Push-ups',
        string $start = '05:00',
        string $end = '12:00',
        array $checkTimes = [5, 6, 7, 8, 9, 10, 11, 12],
    ): void {
        $this->user->workoutReminderSetting()->create([
            'target_count' => $targetCount,
            'activity' => $activity,
            'start_time' => $start,
            'end_time' => $end,
            'check_times' => $checkTimes,
            'active' => true,
        ]);
    }

    public function test_no_target_set_means_no_reminder(): void
    {
        $this->assertFalse($this->status->isDue($this->user));
    }

    public function test_target_not_met_at_check_hour_inside_window_is_due(): void
    {
        $this->setTarget();

        $this->assertTrue($this->status->isDue($this->user));
    }

    public function test_target_met_clears_the_reminder(): void
    {
        $this->setTarget();

        foreach (range(1, 40) as $i) {
            $this->user->workoutEntries()->create([
                'activity' => 'Push-ups',
                'logged_at' => Carbon::parse('2026-11-07 08:00:00'),
            ]);
        }

        $this->assertFalse($this->status->isDue($this->user));
    }

    public function test_outside_the_window_is_not_due(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-07 18:00:00'));
        $this->setTarget();

        $this->assertFalse($this->status->isDue($this->user));
    }

    public function test_before_the_window_is_not_due(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-07 04:00:00'));
        $this->setTarget();

        $this->assertFalse($this->status->isDue($this->user));
    }

    public function test_not_a_check_hour_is_not_due(): void
    {
        // 11:30 is inside the window but 11 is a check hour; test at 11:15
        // would still be hour 11. Use 13:00 which is inside [5,12]? No, 13
        // is past 12. Use a window that includes 13.
        $this->setTarget(start: '05:00', end: '14:00', checkTimes: [5, 6, 7, 8, 9, 10, 11, 12]);
        Carbon::setTestNow(Carbon::parse('2026-11-07 13:30:00'));

        // 13 is not in check_times [5..12], so not due.
        $this->assertFalse($this->status->isDue($this->user));
    }

    public function test_another_users_entries_do_not_clear_it(): void
    {
        $this->setTarget();

        $other = User::factory()->create();
        foreach (range(1, 40) as $i) {
            $other->workoutEntries()->create([
                'activity' => 'Push-ups',
                'logged_at' => Carbon::parse('2026-11-07 08:00:00'),
            ]);
        }

        $this->assertTrue($this->status->isDue($this->user));
    }

    public function test_entries_of_wrong_activity_do_not_count(): void
    {
        $this->setTarget(activity: 'Push-ups');

        $this->user->workoutEntries()->create([
            'activity' => 'Run',
            'logged_at' => Carbon::parse('2026-11-07 08:00:00'),
        ]);

        $this->assertTrue($this->status->isDue($this->user));
    }

    public function test_last_logged_at_reports_the_most_recent_entry(): void
    {
        $this->user->workoutEntries()->create([
            'activity' => 'Run',
            'logged_at' => Carbon::parse('2026-11-05 08:00:00'),
        ]);
        $this->user->workoutEntries()->create([
            'activity' => 'Gym',
            'logged_at' => Carbon::parse('2026-11-06 19:30:00'),
        ]);

        $this->assertSame(
            '2026-11-06 19:30:00',
            $this->status->lastLoggedAt($this->user)?->toDateTimeString(),
        );
    }

    public function test_progress_returns_target_and_count(): void
    {
        $this->setTarget();

        $this->user->workoutEntries()->create([
            'activity' => 'Push-ups',
            'logged_at' => Carbon::parse('2026-11-07 08:00:00'),
        ]);

        $progress = $this->status->progress($this->user);

        $this->assertTrue($progress['active']);
        $this->assertSame(40, $progress['target']);
        $this->assertSame(1, $progress['count']);
        $this->assertSame('Push-ups', $progress['activity']);
        $this->assertSame('05:00', $progress['start_time']);
        $this->assertSame('12:00', $progress['end_time']);
        $this->assertTrue($progress['due']);
    }

    public function test_progress_is_inactive_when_no_target_set(): void
    {
        $progress = $this->status->progress($this->user);

        $this->assertFalse($progress['active']);
        $this->assertNull($progress['target']);
        $this->assertSame(0, $progress['count']);
        $this->assertFalse($progress['due']);
    }
}
