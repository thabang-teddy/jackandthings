<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Exercise;
use App\Models\User;
use App\Models\WorkoutRoutine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Routines and their ordered items, which are saved as one unit: a routine
 * without its exercises is not half-saved, it is broken.
 */
class WorkoutRoutineTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Exercise $bench;

    private Exercise $squat;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->bench = Exercise::factory()->catalog()->create(['name' => 'Bench press']);
        $this->squat = Exercise::factory()->catalog()->create(['name' => 'Back squat']);

        Sanctum::actingAs($this->user);
    }

    public function test_a_routine_is_saved_with_its_items_in_order(): void
    {
        $response = $this->postJson('/api/v1/workout-routines', [
            'name' => 'Push day',
            'items' => [
                ['exercise_id' => $this->squat->getKey(), 'target_sets' => 3, 'target_reps' => 5],
                ['exercise_id' => $this->bench->getKey(), 'target_sets' => 4, 'target_reps' => 8],
            ],
        ])->assertCreated();

        // Position comes from the order the items arrived in, never from the
        // client - a supplied one could duplicate or skip.
        $response->assertJsonPath('data.items.0.exercise_name', 'Back squat');
        $response->assertJsonPath('data.items.0.position', 0);
        $response->assertJsonPath('data.items.1.exercise_name', 'Bench press');
        $response->assertJsonPath('data.items.1.position', 1);
    }

    public function test_a_routine_needs_at_least_one_exercise(): void
    {
        $this->postJson('/api/v1/workout-routines', ['name' => 'Empty day'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['items']);
    }

    public function test_a_routine_cannot_reference_somebody_elses_exercise(): void
    {
        $theirs = Exercise::factory()->for(User::factory()->create())->create();

        $this->postJson('/api/v1/workout-routines', [
            'name' => 'Sneaky day',
            'items' => [['exercise_id' => $theirs->getKey()]],
        ])->assertStatus(422)->assertJsonValidationErrors(['items.0.exercise_id']);
    }

    public function test_a_routine_may_use_a_catalog_exercise(): void
    {
        $this->postJson('/api/v1/workout-routines', [
            'name' => 'Catalog day',
            'items' => [['exercise_id' => $this->bench->getKey()]],
        ])->assertCreated();
    }

    public function test_updating_the_items_replaces_them_outright(): void
    {
        $id = $this->postJson('/api/v1/workout-routines', [
            'name' => 'Push day',
            'items' => [
                ['exercise_id' => $this->squat->getKey()],
                ['exercise_id' => $this->bench->getKey()],
            ],
        ])->json('data.id');

        $this->putJson("/api/v1/workout-routines/{$id}", [
            'items' => [['exercise_id' => $this->bench->getKey()]],
        ])->assertOk()->assertJsonCount(1, 'data.items');
    }

    public function test_a_rename_without_items_leaves_the_exercises_alone(): void
    {
        $id = $this->postJson('/api/v1/workout-routines', [
            'name' => 'Push day',
            'items' => [['exercise_id' => $this->bench->getKey()]],
        ])->json('data.id');

        // A rename should not have to resend the whole routine.
        $this->putJson("/api/v1/workout-routines/{$id}", ['name' => 'Upper body'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Upper body')
            ->assertJsonCount(1, 'data.items');
    }

    public function test_the_whole_save_rolls_back_when_an_item_is_invalid(): void
    {
        $theirs = Exercise::factory()->for(User::factory()->create())->create();

        $this->postJson('/api/v1/workout-routines', [
            'name' => 'Half-valid day',
            'items' => [
                ['exercise_id' => $this->bench->getKey()],
                ['exercise_id' => $theirs->getKey()],
            ],
        ])->assertStatus(422);

        // Validation refuses the request before anything is written, so there
        // is no routine left holding only the exercise that passed.
        $this->assertSame(0, WorkoutRoutine::query()->count());
    }

    public function test_the_list_shows_only_your_own_routines(): void
    {
        WorkoutRoutine::factory()->for($this->user)->create();
        WorkoutRoutine::factory()->for(User::factory()->create())->create();

        $this->getJson('/api/v1/workout-routines')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_an_absurd_target_is_refused(): void
    {
        // The ceiling catches a unit mix-up - kilograms sent into a grams
        // field - rather than doubting a strong user.
        $this->postJson('/api/v1/workout-routines', [
            'name' => 'Mix-up day',
            'items' => [[
                'exercise_id' => $this->bench->getKey(),
                'target_weight_grams' => 9_000_000,
            ]],
        ])->assertStatus(422)->assertJsonValidationErrors(['items.0.target_weight_grams']);
    }
}
