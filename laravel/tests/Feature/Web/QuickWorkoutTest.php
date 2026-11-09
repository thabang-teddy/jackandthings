<?php

declare(strict_types=1);

namespace Tests\Feature\Web;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The home page's quick-log popup posts to the ordinary workouts.store route,
 * but must not throw the user into the Workout module. `return_to` selects the
 * destination; anything else keeps the historical behaviour.
 */
class QuickWorkoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_quick_workout_returns_to_the_home_page(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('workouts.store'), [
                'activity' => '5km run',
                'notes' => 'From the popup',
                'return_to' => 'home',
            ])
            ->assertRedirect(route('home'));

        $this->assertDatabaseHas('workout_entries', [
            'user_id' => $user->id,
            'activity' => '5km run',
        ]);
    }

    public function test_a_workout_created_elsewhere_still_lands_on_the_workout_list(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('workouts.store'), ['activity' => 'Push-ups'])
            ->assertRedirect(route('workouts.index'));
    }

    public function test_the_return_to_field_cannot_redirect_anywhere_else(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('workouts.store'), [
                'activity' => 'Sneaky workout',
                'return_to' => 'https://example.test/elsewhere',
            ])
            ->assertRedirect(route('workouts.index'));
    }

    public function test_a_quick_workout_still_needs_an_activity(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('workouts.store'), [
                'activity' => '',
                'return_to' => 'home',
            ])
            ->assertSessionHasErrors('activity');

        $this->assertDatabaseCount('workout_entries', 0);
    }
}
