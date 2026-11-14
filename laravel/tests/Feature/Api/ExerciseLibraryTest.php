<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Exercise;
use App\Models\User;
use App\Models\WorkoutRoutine;
use App\Models\WorkoutSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The exercise library - the one table in this application with rows that
 * belong to nobody.
 *
 * These tests exist mostly to pin that asymmetry. A seeded catalog row is
 * readable by everybody and writable by no one, and getting that half right
 * while getting the other half wrong would either hide the catalog from
 * everyone or let any user edit it for everyone.
 */
class ExerciseLibraryTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_catalog_is_visible_to_every_user(): void
    {
        $catalog = Exercise::factory()->catalog()->create(['name' => 'Back squat']);
        $user = User::factory()->create();

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/exercises')->assertOk();

        $this->assertSame([$catalog->getKey()], array_column($response->json('data'), 'id'));
    }

    public function test_a_catalog_row_is_not_reported_as_the_users_own(): void
    {
        Exercise::factory()->catalog()->create();
        Sanctum::actingAs(User::factory()->create());

        // `is_custom` is what a client uses to decide whether to offer an edit
        // button, so getting it wrong offers a button that always fails.
        $this->getJson('/api/v1/exercises')
            ->assertOk()
            ->assertJsonPath('data.0.is_custom', false);
    }

    public function test_the_list_carries_the_catalog_and_your_own_but_nobody_elses(): void
    {
        $catalog = Exercise::factory()->catalog()->create();
        $user = User::factory()->create();
        $mine = Exercise::factory()->for($user)->create();
        $theirs = Exercise::factory()->for(User::factory()->create())->create();

        Sanctum::actingAs($user);

        $ids = array_column($this->getJson('/api/v1/exercises')->json('data'), 'id');

        $this->assertEqualsCanonicalizing([$catalog->getKey(), $mine->getKey()], $ids);
        $this->assertNotContains($theirs->getKey(), $ids);
    }

    public function test_a_user_can_create_and_edit_their_own_exercise(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $created = $this->postJson('/api/v1/exercises', [
            'name' => 'Trap bar deadlift',
            'category' => 'strength',
            'metric' => 'weight_reps',
            'cues' => ['Brace first', '  ', 'Bar stays close'],
        ])->assertCreated();

        // Blank cues are dropped rather than stored: an empty cue renders as
        // an empty bullet, which reads as a bug.
        $created->assertJsonPath('data.cues', ['Brace first', 'Bar stays close']);
        $created->assertJsonPath('data.is_custom', true);

        $id = $created->json('data.id');

        $this->putJson("/api/v1/exercises/{$id}", ['name' => 'Trap bar pull'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Trap bar pull');
    }

    public function test_nobody_can_edit_a_catalog_exercise(): void
    {
        $catalog = Exercise::factory()->catalog()->create(['name' => 'Back squat']);

        Sanctum::actingAs(User::factory()->create());

        // 404 rather than 403 everywhere in this app, including here.
        $this->putJson("/api/v1/exercises/{$catalog->getKey()}", ['name' => 'Mine now'])
            ->assertNotFound();

        $this->assertSame('Back squat', $catalog->fresh()->name);
    }

    public function test_nobody_can_delete_a_catalog_exercise(): void
    {
        $catalog = Exercise::factory()->catalog()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->deleteJson("/api/v1/exercises/{$catalog->getKey()}")->assertNotFound();

        $this->assertModelExists($catalog);
    }

    public function test_deleting_an_exercise_a_routine_uses_is_refused_with_a_reason(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->for($user)->create();
        $routine = WorkoutRoutine::factory()->for($user)->create();
        $routine->items()->create(['exercise_id' => $exercise->getKey(), 'position' => 0]);

        Sanctum::actingAs($user);

        // A 422 with the reason, not a 500 from the foreign key - the
        // constraint is a backstop, not the error the user should meet.
        $this->deleteJson("/api/v1/exercises/{$exercise->getKey()}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'That exercise is still used by a routine or a logged set.');

        $this->assertModelExists($exercise);
    }

    public function test_deleting_an_exercise_a_logged_set_uses_is_refused(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->for($user)->create();
        $session = WorkoutSession::factory()->for($user)->create();
        $user->workoutSets()->create([
            'workout_session_id' => $session->getKey(),
            'exercise_id' => $exercise->getKey(),
            'position' => 1,
            'reps' => 5,
            'weight_grams' => 60_000,
            'completed_at' => now(),
        ]);

        Sanctum::actingAs($user);

        $this->deleteJson("/api/v1/exercises/{$exercise->getKey()}")->assertStatus(422);

        $this->assertModelExists($exercise);
    }

    public function test_an_unused_exercise_can_be_deleted(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->for($user)->create();

        Sanctum::actingAs($user);

        $this->deleteJson("/api/v1/exercises/{$exercise->getKey()}")->assertNoContent();

        $this->assertModelMissing($exercise);
    }

    public function test_the_category_and_metric_must_be_ones_the_server_knows(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/exercises', [
            'name' => 'Something',
            'category' => 'interpretive-dance',
            'metric' => 'vibes',
        ])->assertStatus(422)->assertJsonValidationErrors(['category', 'metric']);
    }

    public function test_history_is_null_for_an_exercise_never_trained(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->catalog()->create();

        Sanctum::actingAs($user);

        // Null, not an empty history: "never done this" and "did it and got
        // nowhere" are different things to put in front of somebody.
        $this->getJson("/api/v1/exercises/{$exercise->getKey()}/history")
            ->assertOk()
            ->assertJsonPath('data', null);
    }
}
