<?php

declare(strict_types=1);

namespace Tests\Feature\Services;

use App\Enums\ExerciseMetric;
use App\Models\Exercise;
use App\Models\User;
use App\Models\WorkoutSession;
use App\Models\WorkoutSet;
use App\Services\WorkoutRecords;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Personal records and the progressive-overload history.
 *
 * The arithmetic here is duplicated in three clients, so these tests are the
 * reference the other three are written against. If this file and
 * workoutProgress.test.js ever disagree, one of the four surfaces is lying to
 * the user about a personal best.
 */
class WorkoutRecordsTest extends TestCase
{
    use RefreshDatabase;

    private WorkoutRecords $records;

    private User $user;

    private Exercise $exercise;

    protected function setUp(): void
    {
        parent::setUp();

        $this->records = app(WorkoutRecords::class);
        $this->user = User::factory()->create();
        $this->exercise = Exercise::factory()->catalog()->create(['name' => 'Bench press']);
    }

    public function test_a_single_rep_is_its_own_one_rep_max(): void
    {
        // Epley would inflate a single by a thirtieth, which would quietly
        // report a heavier max than the user has ever actually lifted.
        $this->assertSame(100_000, $this->records->estimatedOneRepMax(100_000, 1));
    }

    public function test_epley_is_applied_above_one_rep(): void
    {
        // 62.5kg x 5 => 62500 * (1 + 5/30) = 72916.67, rounded.
        $this->assertSame(72_917, $this->records->estimatedOneRepMax(62_500, 5));
    }

    public function test_a_set_without_both_a_load_and_reps_has_no_one_rep_max(): void
    {
        $this->assertNull($this->records->estimatedOneRepMax(null, 5));
        $this->assertNull($this->records->estimatedOneRepMax(100_000, null));
        $this->assertNull($this->records->estimatedOneRepMax(100_000, 0));
    }

    public function test_the_best_figures_ignore_warmups(): void
    {
        $session = $this->workout();

        $this->set($session, ['weight_grams' => 60_000, 'reps' => 5]);
        $this->set($session, ['weight_grams' => 200_000, 'reps' => 20, 'is_warmup' => true]);

        $best = $this->records->bestFor($this->user, $this->exercise);

        // A warm-up is logged so the session reads honestly, but it is never
        // somebody's best - a 200kg "warm-up" must not become a record.
        $this->assertSame(60_000, $best['best_weight_grams']);
        $this->assertSame(5, $best['best_reps']);
    }

    public function test_an_exercise_never_trained_reports_nulls_not_zeroes(): void
    {
        $best = $this->records->bestFor($this->user, $this->exercise);

        // Null means "not measured". Zero would read as a terrible lift.
        $this->assertNull($best['best_weight_grams']);
        $this->assertNull($best['best_one_rep_max_grams']);
        $this->assertNull($best['best_reps']);
    }

    public function test_last_performance_is_null_before_anything_is_logged(): void
    {
        $this->assertNull($this->records->lastPerformance($this->user, $this->exercise));
    }

    public function test_last_performance_groups_sets_by_session_newest_first(): void
    {
        $old = $this->workout(Carbon::parse('2026-11-01 09:00:00'));
        $recent = $this->workout(Carbon::parse('2026-11-10 09:00:00'));

        $this->set($old, ['weight_grams' => 50_000, 'reps' => 5, 'completed_at' => Carbon::parse('2026-11-01 09:10:00')]);
        $this->set($recent, ['weight_grams' => 60_000, 'reps' => 5, 'completed_at' => Carbon::parse('2026-11-10 09:10:00')]);
        $this->set($recent, ['weight_grams' => 60_000, 'reps' => 4, 'completed_at' => Carbon::parse('2026-11-10 09:15:00')]);

        $history = $this->records->lastPerformance($this->user, $this->exercise);

        $this->assertSame($recent->getKey(), $history['sessions'][0]['session_id']);
        $this->assertCount(2, $history['sessions'][0]['sets']);
        $this->assertSame($old->getKey(), $history['sessions'][1]['session_id']);
    }

    public function test_a_first_ever_set_is_a_record(): void
    {
        $session = $this->workout();
        $set = $this->set($session, ['weight_grams' => 40_000, 'reps' => 5]);

        $this->assertTrue($this->records->isRecord($this->user, $set));
    }

    public function test_a_heavier_set_is_a_record_and_a_lighter_one_is_not(): void
    {
        $session = $this->workout();

        $this->set($session, ['weight_grams' => 100_000, 'reps' => 5]);

        $heavier = $this->set($session, ['weight_grams' => 110_000, 'reps' => 5]);
        $lighter = $this->set($session, ['weight_grams' => 80_000, 'reps' => 5]);

        $this->assertTrue($this->records->isRecord($this->user, $heavier));
        $this->assertFalse($this->records->isRecord($this->user, $lighter));
    }

    public function test_more_reps_at_a_lighter_load_still_counts_as_a_record(): void
    {
        $session = $this->workout();

        $this->set($session, ['weight_grams' => 100_000, 'reps' => 5]);

        // Lighter, but more reps than ever before. A record in *any* measure
        // the set carries is a record - otherwise a rep PR goes unnoticed.
        $repPr = $this->set($session, ['weight_grams' => 60_000, 'reps' => 12]);

        $this->assertTrue($this->records->isRecord($this->user, $repPr));
    }

    public function test_another_users_sets_never_count_towards_your_records(): void
    {
        $theirUser = User::factory()->create();
        $theirSession = WorkoutSession::factory()->for($theirUser)->create();

        $theirUser->workoutSets()->create([
            'workout_session_id' => $theirSession->getKey(),
            'exercise_id' => $this->exercise->getKey(),
            'position' => 1,
            'weight_grams' => 300_000,
            'reps' => 5,
            'completed_at' => now(),
        ]);

        $mine = $this->set($this->workout(), ['weight_grams' => 40_000, 'reps' => 5]);

        // Their 300kg must not make my 40kg "not a record".
        $this->assertTrue($this->records->isRecord($this->user, $mine));
        $this->assertSame(
            40_000,
            $this->records->bestFor($this->user, $this->exercise)['best_weight_grams'],
        );
    }

    public function test_a_cardio_record_uses_distance_and_time(): void
    {
        $run = Exercise::factory()
            ->catalog()
            ->metric(ExerciseMetric::DistanceDuration)
            ->create(['name' => 'Running']);

        $session = $this->workout();

        $this->user->workoutSets()->create([
            'workout_session_id' => $session->getKey(),
            'exercise_id' => $run->getKey(),
            'position' => 1,
            'distance_metres' => 5_000,
            'duration_seconds' => 1_470,
            'completed_at' => now(),
        ]);

        $best = $this->records->bestFor($this->user, $run);

        $this->assertSame(5_000, $best['best_distance_metres']);
        $this->assertSame(1_470, $best['best_duration_seconds']);
        // A run has no volume: volume is a strength measure.
        $this->assertNull($best['best_weight_grams']);
        $this->assertSame(0, $best['best_volume_grams']);
    }

    public function test_the_records_list_is_ordered_by_estimated_one_rep_max(): void
    {
        $squat = Exercise::factory()->catalog()->create(['name' => 'Back squat']);
        $session = $this->workout();

        $this->set($session, ['weight_grams' => 60_000, 'reps' => 5]);

        $this->user->workoutSets()->create([
            'workout_session_id' => $session->getKey(),
            'exercise_id' => $squat->getKey(),
            'position' => 9,
            'weight_grams' => 120_000,
            'reps' => 5,
            'completed_at' => now(),
        ]);

        $records = $this->records->all($this->user);

        $this->assertSame('Back squat', $records[0]['exercise_name']);
        $this->assertSame('Bench press', $records[1]['exercise_name']);
    }

    private function workout(?Carbon $startedAt = null): WorkoutSession
    {
        return WorkoutSession::factory()
            ->for($this->user)
            ->create(['started_at' => $startedAt ?? now()]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function set(WorkoutSession $session, array $attributes): WorkoutSet
    {
        return $this->user->workoutSets()->create([
            'workout_session_id' => $session->getKey(),
            'exercise_id' => $this->exercise->getKey(),
            'position' => $session->sets()->count() + 1,
            'completed_at' => $attributes['completed_at'] ?? now(),
            ...$attributes,
        ]);
    }
}
