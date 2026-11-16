<?php

declare(strict_types=1);

namespace Tests\Feature\Web;

use App\Models\User;
use App\Models\WorkoutReminderSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The reminder state an open page polls for its desktop nudge.
 *
 * It mirrors api.v1 workout-entries.due for the session guard. The reminder
 * is now target-based: a user sets a target count and activity, a daily
 * window, and check hours. The reminder is due at a check hour inside the
 * window when fewer than the target number of matching entries have been
 * logged since the window opened. The server still sends nothing itself:
 * this only reports state, and the page decides whether to notify.
 */
class WorkoutDueEndpointTest extends TestCase
{
    use RefreshDatabase;

    private function setTarget(User $user): void
    {
        $user->workoutReminderSetting()->create([
            'target_count' => 40,
            'activity' => 'Push-ups',
            'start_time' => '05:00',
            'end_time' => '12:00',
            'check_times' => [5, 6, 7, 8, 9, 10, 11, 12],
            'active' => true,
        ]);
    }

    public function test_it_reports_due_when_target_not_met_at_check_hour(): void
    {
        $this->travelTo(Carbon::parse('2026-11-12 11:30:00'));

        $user = User::factory()->create();
        $this->setTarget($user);

        $this->actingAs($user)
            ->getJson(route('workouts.due'))
            ->assertOk()
            ->assertJson([
                'due' => true,
                'last_logged_at' => null,
            ])
            ->assertJsonPath('progress.target', 40)
            ->assertJsonPath('progress.count', 0)
            ->assertJsonPath('progress.due', true);
    }

    public function test_it_reports_not_due_once_target_is_met(): void
    {
        $this->travelTo(Carbon::parse('2026-11-12 11:30:00'));

        $user = User::factory()->create();
        $this->setTarget($user);
        foreach (range(1, 40) as $i) {
            $user->workoutEntries()->create([
                'activity' => 'Push-ups',
                'logged_at' => Carbon::parse('2026-11-12 08:00:00'),
            ]);
        }

        $this->actingAs($user)
            ->getJson(route('workouts.due'))
            ->assertOk()
            ->assertJson([
                'due' => false,
                'progress' => [
                    'target' => 40,
                    'count' => 40,
                ],
            ]);
    }

    public function test_an_entry_on_the_hour_counts_toward_target(): void
    {
        $this->travelTo(Carbon::parse('2026-11-12 11:30:00'));

        $user = User::factory()->create();
        $this->setTarget($user);
        $user->workoutEntries()->create([
            'activity' => 'Push-ups',
            'logged_at' => Carbon::parse('2026-11-12 11:00:00'),
        ]);

        $this->actingAs($user)
            ->getJson(route('workouts.due'))
            ->assertJsonPath('progress.count', 1)
            ->assertJsonPath('progress.due', true);
    }

    public function test_a_user_with_no_target_is_not_due(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson(route('workouts.due'))
            ->assertOk()
            ->assertJson([
                'due' => false,
                'progress' => ['active' => false],
            ]);
    }

    public function test_another_users_workout_does_not_clear_your_nudge(): void
    {
        $this->travelTo(Carbon::parse('2026-11-12 11:30:00'));

        $user = User::factory()->create();
        $this->setTarget($user);
        $other = User::factory()->create();
        foreach (range(1, 40) as $i) {
            $other->workoutEntries()->create([
                'activity' => 'Push-ups',
                'logged_at' => Carbon::parse('2026-11-12 08:00:00'),
            ]);
        }

        $this->actingAs($user)
            ->getJson(route('workouts.due'))
            ->assertJson(['due' => true]);
    }

    public function test_the_time_is_sent_as_an_absolute_instant(): void
    {
        $user = User::factory()->create();
        $user->workoutEntries()->create([
            'activity' => 'Run',
            'logged_at' => Carbon::parse('2026-11-12 18:00:00'),
        ]);

        // ISO-8601 with an offset, not a pre-formatted local string: every
        // client renders it in the viewer's own zone.
        $this->actingAs($user)
            ->getJson(route('workouts.due'))
            ->assertJsonPath('last_logged_at', '2026-11-12T18:00:00+00:00');
    }

    public function test_a_signed_out_visitor_cannot_read_it(): void
    {
        $this->get(route('workouts.due'))->assertRedirect(route('login'));
    }

    public function test_due_is_not_swallowed_by_the_workouts_resource_routes(): void
    {
        // "due" sits in front of the resource, so it must not be read as a
        // {workout} id by workouts.edit or workouts.update.
        $this->assertSame(
            url('/workouts/due'),
            route('workouts.due'),
        );
    }
}
