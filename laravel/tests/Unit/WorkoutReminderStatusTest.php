<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\User;
use App\Services\WorkoutReminderStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * "Due" means nothing logged since the top of the current hour.
 *
 * The boundary is the whole rule, so it is pinned here: the Android app and
 * the browser add-on both poll this and decide whether to raise a
 * notification, and the server itself sends nothing.
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

    public function test_a_user_who_has_never_logged_anything_is_due(): void
    {
        $this->assertTrue($this->status->isDue($this->user));
        $this->assertNull($this->status->lastLoggedAt($this->user));
    }

    public function test_logging_within_the_current_hour_clears_it(): void
    {
        $this->user->workoutEntries()->create([
            'activity' => 'Push-ups',
            'logged_at' => Carbon::parse('2026-11-07 11:05:00'),
        ]);

        $this->assertFalse($this->status->isDue($this->user));
    }

    public function test_an_entry_from_the_previous_hour_does_not_count(): void
    {
        // 11:00 is the cut-off, so 10:59 is a different hour even though it is
        // only a minute earlier.
        $this->user->workoutEntries()->create([
            'activity' => 'Run',
            'logged_at' => Carbon::parse('2026-11-07 10:59:00'),
        ]);

        $this->assertTrue($this->status->isDue($this->user));
    }

    public function test_an_entry_exactly_on_the_hour_counts(): void
    {
        $this->user->workoutEntries()->create([
            'activity' => 'Walk',
            'logged_at' => Carbon::parse('2026-11-07 11:00:00'),
        ]);

        $this->assertFalse($this->status->isDue($this->user));
    }

    public function test_another_users_workout_does_not_clear_it(): void
    {
        $other = User::factory()->create();
        $other->workoutEntries()->create([
            'activity' => 'Run',
            'logged_at' => Carbon::parse('2026-11-07 11:05:00'),
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
}
