<?php

declare(strict_types=1);

namespace Tests\Feature\Web;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The reminder state an open page polls for its desktop nudge.
 *
 * It mirrors api.v1 workout-entries.due for the session guard. The server
 * still sends nothing itself: this only reports whether anything has been
 * logged this clock hour, and the page decides whether to notify.
 */
class WorkoutDueEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_reports_due_when_nothing_was_logged_this_hour(): void
    {
        $this->travelTo(Carbon::parse('2026-11-12 14:30:00'));

        $user = User::factory()->create();
        $user->workoutEntries()->create([
            'activity' => 'Run',
            'logged_at' => Carbon::parse('2026-11-12 13:59:00'),
        ]);

        $this->actingAs($user)
            ->getJson(route('workouts.due'))
            ->assertOk()
            ->assertJson([
                'due' => true,
                'last_logged_at' => '2026-11-12T13:59:00+00:00',
            ]);
    }

    public function test_it_reports_not_due_once_something_is_logged_this_hour(): void
    {
        $this->travelTo(Carbon::parse('2026-11-12 14:30:00'));

        $user = User::factory()->create();
        $user->workoutEntries()->create([
            'activity' => 'Push-ups',
            'logged_at' => Carbon::parse('2026-11-12 14:05:00'),
        ]);

        $this->actingAs($user)
            ->getJson(route('workouts.due'))
            ->assertOk()
            ->assertJson(['due' => false]);
    }

    public function test_an_entry_on_the_hour_counts_as_this_hour(): void
    {
        $this->travelTo(Carbon::parse('2026-11-12 14:30:00'));

        $user = User::factory()->create();
        $user->workoutEntries()->create([
            'activity' => 'Run',
            'logged_at' => Carbon::parse('2026-11-12 14:00:00'),
        ]);

        $this->actingAs($user)
            ->getJson(route('workouts.due'))
            ->assertJson(['due' => false]);
    }

    public function test_a_user_with_no_workouts_at_all_is_due_and_has_no_last(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson(route('workouts.due'))
            ->assertOk()
            ->assertJson(['due' => true, 'last_logged_at' => null]);
    }

    public function test_another_users_workout_does_not_clear_your_nudge(): void
    {
        $this->travelTo(Carbon::parse('2026-11-12 14:30:00'));

        $user = User::factory()->create();
        $other = User::factory()->create();
        $other->workoutEntries()->create([
            'activity' => 'Theirs',
            'logged_at' => Carbon::parse('2026-11-12 14:05:00'),
        ]);

        $this->actingAs($user)
            ->getJson(route('workouts.due'))
            ->assertJson(['due' => true, 'last_logged_at' => null]);
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
