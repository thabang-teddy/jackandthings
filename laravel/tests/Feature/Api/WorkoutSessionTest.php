<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Exercise;
use App\Models\User;
use App\Models\WorkoutRoutine;
use App\Models\WorkoutSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Starting a workout, logging sets into it, and finishing it.
 *
 * The behaviours pinned here are the ones that would be quietly wrong rather
 * than loudly broken: who assigns a set's position, who decides when a workout
 * ended, and whether a repeated tap can move that time.
 */
class WorkoutSessionTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Exercise $exercise;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->exercise = Exercise::factory()->catalog()->create(['name' => 'Bench press']);

        Sanctum::actingAs($this->user);
    }

    public function test_current_is_null_rather_than_404_when_nothing_is_running(): void
    {
        // "No workout in progress" is the normal state, not an error.
        $this->getJson('/api/v1/workout-sessions/current')
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_starting_a_workout_copies_the_routine_name_onto_it(): void
    {
        $routine = WorkoutRoutine::factory()->for($this->user)->create(['name' => 'Push day']);

        $this->postJson('/api/v1/workout-sessions', ['workout_routine_id' => $routine->getKey()])
            ->assertCreated()
            ->assertJsonPath('data.routine_name', 'Push day')
            ->assertJsonPath('data.is_open', true);
    }

    public function test_the_routine_name_survives_the_routine_being_deleted(): void
    {
        $routine = WorkoutRoutine::factory()->for($this->user)->create(['name' => 'Push day']);

        $id = $this->postJson('/api/v1/workout-sessions', [
            'workout_routine_id' => $routine->getKey(),
        ])->json('data.id');

        $routine->delete();

        // The workout happened. Deleting the template must not erase it or
        // rewrite what it was called at the time.
        $this->getJson("/api/v1/workout-sessions/{$id}")
            ->assertOk()
            ->assertJsonPath('data.routine_name', 'Push day')
            ->assertJsonPath('data.workout_routine_id', null);
    }

    public function test_a_session_cannot_claim_somebody_elses_routine(): void
    {
        $theirs = WorkoutRoutine::factory()->for(User::factory()->create())->create();

        $this->postJson('/api/v1/workout-sessions', ['workout_routine_id' => $theirs->getKey()])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['workout_routine_id']);
    }

    public function test_a_freestyle_workout_is_allowed(): void
    {
        // Turning up and lifting without a plan is a real workout.
        $this->postJson('/api/v1/workout-sessions', [])
            ->assertCreated()
            ->assertJsonPath('data.routine_name', null);
    }

    public function test_the_server_assigns_set_positions(): void
    {
        $session = WorkoutSession::factory()->for($this->user)->open()->create();

        foreach ([1, 2, 3] as $ignored) {
            $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/sets", [
                'exercise_id' => $this->exercise->getKey(),
                'reps' => 5,
                'weight_grams' => 60_000,
                // Sent deliberately, and deliberately ignored: two devices
                // logging at once must not be able to claim one slot.
                'position' => 99,
            ])->assertCreated();
        }

        $positions = $this->getJson("/api/v1/workout-sessions/{$session->getKey()}/sets")
            ->json('data.*.position');

        $this->assertSame([1, 2, 3], $positions);
    }

    public function test_a_set_needs_at_least_one_measure(): void
    {
        $session = WorkoutSession::factory()->for($this->user)->open()->create();

        // A row with no numbers in it is not a set, and would skew volume and
        // records by counting as an entry with nothing in it.
        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/sets", [
            'exercise_id' => $this->exercise->getKey(),
        ])->assertStatus(422)->assertJsonValidationErrors(['reps']);
    }

    public function test_a_first_set_of_an_exercise_is_reported_as_a_record(): void
    {
        $session = WorkoutSession::factory()->for($this->user)->open()->create();

        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/sets", [
            'exercise_id' => $this->exercise->getKey(),
            'reps' => 5,
            'weight_grams' => 60_000,
        ])->assertCreated()->assertJsonPath('is_record', true);
    }

    public function test_a_lighter_later_set_is_not_a_record(): void
    {
        $session = WorkoutSession::factory()->for($this->user)->open()->create();

        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/sets", [
            'exercise_id' => $this->exercise->getKey(),
            'reps' => 5,
            'weight_grams' => 100_000,
        ])->assertCreated();

        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/sets", [
            'exercise_id' => $this->exercise->getKey(),
            'reps' => 5,
            'weight_grams' => 60_000,
        ])->assertCreated()->assertJsonPath('is_record', false);
    }

    public function test_a_warmup_is_never_a_record(): void
    {
        $session = WorkoutSession::factory()->for($this->user)->open()->create();

        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/sets", [
            'exercise_id' => $this->exercise->getKey(),
            'reps' => 20,
            'weight_grams' => 200_000,
            'is_warmup' => true,
        ])->assertCreated()->assertJsonPath('is_record', false);
    }

    public function test_a_set_cannot_name_somebody_elses_exercise(): void
    {
        $session = WorkoutSession::factory()->for($this->user)->open()->create();
        $theirs = Exercise::factory()->for(User::factory()->create())->create();

        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/sets", [
            'exercise_id' => $theirs->getKey(),
            'reps' => 5,
        ])->assertStatus(422)->assertJsonValidationErrors(['exercise_id']);
    }

    public function test_finishing_stamps_the_time_on_the_server(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 18:00:00'));

        $session = WorkoutSession::factory()->for($this->user)->open()->create();

        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/finish")
            ->assertOk()
            ->assertJsonPath('data.is_open', false)
            ->assertJsonPath('data.finished_at', '2026-11-14T18:00:00+00:00');
    }

    public function test_finishing_twice_leaves_the_first_time_standing(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 18:00:00'));
        $session = WorkoutSession::factory()->for($this->user)->open()->create();

        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/finish")->assertOk();

        $this->travelTo(Carbon::parse('2026-11-14 19:30:00'));

        // A repeated tap on a flaky connection must not move the workout an
        // hour and a half later than it really ended.
        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/finish")
            ->assertOk()
            ->assertJsonPath('data.finished_at', '2026-11-14T18:00:00+00:00');
    }

    public function test_the_session_payload_totals_its_sets(): void
    {
        $session = WorkoutSession::factory()->for($this->user)->open()->create();

        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/sets", [
            'exercise_id' => $this->exercise->getKey(),
            'reps' => 5,
            'weight_grams' => 60_000,
        ])->assertCreated();

        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/sets", [
            'exercise_id' => $this->exercise->getKey(),
            'reps' => 10,
            'weight_grams' => 20_000,
            'is_warmup' => true,
        ])->assertCreated();

        // 60kg x 5 counts; the warm-up does not, even though it is listed.
        $this->getJson("/api/v1/workout-sessions/{$session->getKey()}")
            ->assertOk()
            ->assertJsonPath('data.set_count', 2)
            ->assertJsonPath('data.volume_grams', 300_000);
    }

    public function test_deleting_a_workout_takes_its_sets_with_it(): void
    {
        $session = WorkoutSession::factory()->for($this->user)->open()->create();

        $this->postJson("/api/v1/workout-sessions/{$session->getKey()}/sets", [
            'exercise_id' => $this->exercise->getKey(),
            'reps' => 5,
            'weight_grams' => 60_000,
        ])->assertCreated();

        $this->deleteJson("/api/v1/workout-sessions/{$session->getKey()}")->assertNoContent();

        // A deleted workout must not leave its sets standing in the records.
        $this->assertSame(0, $this->user->workoutSets()->count());
    }
}
