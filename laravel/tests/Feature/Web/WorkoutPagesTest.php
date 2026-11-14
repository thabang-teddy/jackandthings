<?php

declare(strict_types=1);

namespace Tests\Feature\Web;

use App\Models\Exercise;
use App\Models\User;
use App\Models\WorkoutRoutine;
use App\Models\WorkoutSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * The Workout module's six pages.
 *
 * Each action loads only what its own page draws, which is the whole reason
 * the module was split - so these assert the props as much as the status, and
 * one of them asserts an *absence*.
 */
class WorkoutPagesTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
    }

    public function test_today_carries_the_quick_log_the_routines_and_any_open_session(): void
    {
        $routine = WorkoutRoutine::factory()->for($this->user)->create();
        WorkoutSession::factory()->for($this->user)->open()->create();

        $this->actingAs($this->user)
            ->get(route('workouts.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Workout/Index')
                ->has('entries')
                ->has('presets')
                ->has('routines', 1)
                ->has('exercises')
                ->where('openSession.id', WorkoutSession::query()->firstOrFail()->getKey())
                ->where('routines.0.id', $routine->getKey())
                ->has('dueForReminder'));
    }

    public function test_today_reports_no_open_session_as_null(): void
    {
        $this->actingAs($this->user)
            ->get(route('workouts.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('openSession', null));
    }

    public function test_the_library_lists_the_catalog_and_the_users_own(): void
    {
        Exercise::factory()->catalog()->create();
        Exercise::factory()->for($this->user)->create();
        Exercise::factory()->for(User::factory()->create())->create();

        $this->actingAs($this->user)
            ->get(route('workouts.library'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Workout/Library')
                ->has('exercises', 2)
                ->has('categories', 4)
                ->has('metrics', 4));
    }

    public function test_the_routines_page_carries_the_exercise_picker(): void
    {
        Exercise::factory()->catalog()->create();

        $this->actingAs($this->user)
            ->get(route('workouts.routines'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Workout/Routines')
                ->has('routines')
                ->has('exercises', 1));
    }

    public function test_the_sessions_page_loads_no_analytics(): void
    {
        $this->actingAs($this->user)
            ->get(route('workouts.sessions'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Workout/Sessions')
                ->has('sessions')
                ->has('entries')
                // The point of splitting the module: opening the history must
                // not run the 90-day calendar or the records query.
                ->missing('analytics')
                ->missing('records'));
    }

    public function test_the_body_page_carries_the_sites_and_the_upload_limit(): void
    {
        $this->actingAs($this->user)
            ->get(route('workouts.body'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Workout/Body')
                ->has('metrics')
                ->has('photos')
                ->has('sites', 7)
                ->where('maxPhotoKilobytes', 8192));
    }

    public function test_the_stats_page_buckets_in_the_timezone_it_is_given(): void
    {
        $this->actingAs($this->user)
            ->get(route('workouts.stats', ['tz' => 'Africa/Johannesburg']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Workout/Stats')
                ->where('analytics.timezone', 'Africa/Johannesburg')
                ->has('records'));
    }

    public function test_the_stats_page_rejects_a_junk_timezone(): void
    {
        $this->actingAs($this->user)
            ->get(route('workouts.stats', ['tz' => 'Mars/Olympus_Mons']))
            ->assertSessionHasErrors('tz');
    }

    public function test_a_signed_out_visitor_reaches_none_of_the_six_pages(): void
    {
        foreach ([
            'workouts.index',
            'workouts.library',
            'workouts.routines',
            'workouts.sessions',
            'workouts.body',
            'workouts.stats',
        ] as $name) {
            $this->get(route($name))->assertRedirect(route('login'));
        }
    }

    public function test_the_page_routes_are_not_read_as_entry_ids(): void
    {
        // Route::resource('workouts') binds {workout}, so every literal path
        // segment has to be declared before it or "library" becomes an id.
        $this->actingAs($this->user);

        foreach (['library', 'routines', 'sessions', 'body', 'stats'] as $segment) {
            $this->get("/workouts/{$segment}")->assertOk();
        }
    }

    public function test_the_live_logger_can_fetch_what_was_done_last_time(): void
    {
        $exercise = Exercise::factory()->catalog()->create();
        $session = WorkoutSession::factory()->for($this->user)->create();

        $this->user->workoutSets()->create([
            'workout_session_id' => $session->getKey(),
            'exercise_id' => $exercise->getKey(),
            'position' => 1,
            'reps' => 5,
            'weight_grams' => 62_500,
            'completed_at' => now(),
        ]);

        // Fetched as the exercise changes rather than shipped with the page:
        // preloading a history for every exercise in the library to show one
        // of them would be absurd.
        $this->actingAs($this->user)
            ->getJson(route('workouts.exercises.history', $exercise))
            ->assertOk()
            ->assertJsonPath('data.sessions.0.sets.0.weight_grams', 62_500)
            // 62.5kg x 5 by Epley, the same figure all four surfaces compute.
            ->assertJsonPath('data.best.best_one_rep_max_grams', 72_917);
    }

    public function test_the_history_of_an_untrained_exercise_is_null(): void
    {
        $exercise = Exercise::factory()->catalog()->create();

        // Null, not an empty history: the page says "no history yet" rather
        // than showing zeroes, which would read as a terrible session.
        $this->actingAs($this->user)
            ->getJson(route('workouts.exercises.history', $exercise))
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_another_users_exercise_history_is_not_reachable(): void
    {
        $theirs = Exercise::factory()->for(User::factory()->create())->create();

        $this->actingAs($this->user)
            ->getJson(route('workouts.exercises.history', $theirs))
            ->assertNotFound();
    }

    public function test_a_logged_set_silences_the_hourly_nudge(): void
    {
        $this->travelTo(Carbon::parse('2026-11-14 14:30:00'));

        $exercise = Exercise::factory()->catalog()->create();
        $session = WorkoutSession::factory()->for($this->user)->open()->create();

        $this->user->workoutSets()->create([
            'workout_session_id' => $session->getKey(),
            'exercise_id' => $exercise->getKey(),
            'position' => 1,
            'reps' => 5,
            'weight_grams' => 60_000,
            'completed_at' => Carbon::parse('2026-11-14 14:05:00'),
        ]);

        // Nudging somebody who has just finished a tracked workout is worse
        // than staying quiet: the reminder would be asserting something they
        // know to be false.
        $this->actingAs($this->user)
            ->getJson(route('workouts.due'))
            ->assertOk()
            ->assertJsonPath('due', false);
    }
}
