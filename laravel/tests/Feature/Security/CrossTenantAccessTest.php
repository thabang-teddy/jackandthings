<?php

declare(strict_types=1);

namespace Tests\Feature\Security;

use App\Models\BodyMetric;
use App\Models\BudgetAccount;
use App\Models\Exercise;
use App\Models\HistoryEntry;
use App\Models\Note;
use App\Models\PomodoroPreset;
use App\Models\PomodoroSession;
use App\Models\ProgressPhoto;
use App\Models\RecurringTransaction;
use App\Models\User;
use App\Models\WatchList;
use App\Models\WatchListItem;
use App\Models\WorkoutEntry;
use App\Models\WorkoutPreset;
use App\Models\WorkoutRoutine;
use App\Models\WorkoutSession;
use App\Services\BudgetService;
use App\Services\ProgressPhotoStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The isolation guarantee, swept across every model-bound route.
 *
 * docs/SECURITY.md calls cross-tenant leakage the top threat, and the rule is
 * that a record belonging to somebody else resolves to 404 — never 403, which
 * would confirm it exists. These tests exist because that property was only
 * ever checked by hand before, and by hand it is easy to check wrongly: the
 * first manual sweep passed because the ids never parsed, so every request hit
 * a nonexistent record and 404'd for the wrong reason. Hence the guard in
 * buildVictimFixture() and the route-table audit at the bottom.
 */
class CrossTenantAccessTest extends TestCase
{
    use RefreshDatabase;

    /** Records owned by the victim, keyed by the route parameter name. */
    private array $victimRecords = [];

    /**
     * A catalog exercise, which belongs to nobody and is usable by both
     * users.
     *
     * The set-logging payloads need one. Pointing them at the victim's own
     * exercise would make the attacker's request fail the scoped
     * `Rule::exists` and return 422 *before* the session's ownership check
     * ever ran - so the test would pass without proving the thing it claims
     * to prove. With a shared exercise, validation passes for both and the
     * 404 can only come from the session check, which is the actual threat:
     * logging a set into somebody else's workout.
     */
    private Exercise $sharedExercise;

    private User $victim;

    private User $attacker;

    protected function setUp(): void
    {
        parent::setUp();

        // The photo fixture needs a file behind it: the download action 404s
        // on a missing file, which would otherwise look like an ownership
        // failure and make the sweep pass for the wrong reason.
        Storage::fake(ProgressPhotoStorage::DISK);

        $this->victim = User::factory()->create();
        $this->attacker = User::factory()->create();
        $this->sharedExercise = Exercise::factory()->catalog()->create();
        $this->buildVictimFixture();
    }

    private function buildVictimFixture(): void
    {
        $account = BudgetAccount::factory()->for($this->victim)->create(['name' => 'Victim cash']);
        $other = BudgetAccount::factory()->for($this->victim)->create(['name' => 'Victim savings']);

        $budget = app(BudgetService::class);
        $budget->deposit($this->victim, $account, 50_000, 'seed');
        $transaction = $this->victim->budgetTransactions()->latest()->firstOrFail();

        // Issue #4's records. `exercise` is deliberately one the victim owns,
        // not a catalog row: a catalog exercise is readable by everybody by
        // design, so using one here would assert the opposite of the rule.
        $exercise = Exercise::factory()->for($this->victim)->create();
        $routine = WorkoutRoutine::factory()->for($this->victim)->create();
        $routine->items()->create(['exercise_id' => $exercise->getKey(), 'position' => 0]);
        $workoutSession = WorkoutSession::factory()->for($this->victim)->open()->create();
        $workoutSet = $this->victim->workoutSets()->create([
            'workout_session_id' => $workoutSession->getKey(),
            'exercise_id' => $exercise->getKey(),
            'position' => 1,
            'reps' => 5,
            'weight_grams' => 60_000,
            'completed_at' => now(),
        ]);

        $this->victimRecords = [
            'exercise' => $exercise,
            'routine' => $routine,
            'session' => $workoutSession,
            'set' => $workoutSet,
            'metric' => BodyMetric::factory()->for($this->victim)->create(),
            'photo' => $this->photoWithAFile(),
            'note' => Note::factory()->for($this->victim)->create(),
            'preset' => $preset = PomodoroPreset::factory()->for($this->victim)->create(),
            'pomodoroSession' => PomodoroSession::factory()
                ->for($this->victim)
                ->create(['pomodoro_preset_id' => $preset->getKey()]),
            'watchList' => $watchList = WatchList::factory()->for($this->victim)->create(),
            'watchListItem' => WatchListItem::factory()
                ->for($this->victim)
                ->create(['watch_list_id' => $watchList->getKey()]),
            'workout' => WorkoutEntry::factory()->for($this->victim)->create(),
            'workoutPreset' => WorkoutPreset::factory()->for($this->victim)->create(),
            'history' => HistoryEntry::factory()->for($this->victim)->create(),
            'account' => $account,
            'transaction' => $transaction,
            'recurring' => RecurringTransaction::factory()
                ->for($this->victim)
                ->create(['account_id' => $account->getKey()]),
        ];

        // Without this, a typo in the fixture would make every request below
        // hit a missing record and 404 for the wrong reason — which is exactly
        // how the manual version of this check fooled us once.
        foreach ($this->victimRecords as $key => $record) {
            $this->assertNotNull($record->getKey(), "fixture for '{$key}' has no key");
            $this->assertSame(
                $this->victim->getKey(),
                $record->user_id,
                "fixture for '{$key}' is not owned by the victim",
            );
        }

        $this->assertNotSame($account->getKey(), $other->getKey());
    }

    /**
     * Every model-bound route, with a body valid enough to reach the ownership
     * check: a write that fails validation would be rejected before the policy
     * runs and would prove nothing.
     *
     * @return array<string, array{string, string, array<string, mixed>}>
     */
    public static function tenantOwnedEndpoints(): array
    {
        return [
            // ── Web ───────────────────────────────────────────────────────
            'web notes.edit' => ['GET', '/notes/{note}/edit', []],
            'web notes.update' => ['PUT', '/notes/{note}', ['title' => 'x']],
            'web notes.destroy' => ['DELETE', '/notes/{note}', []],

            'web preset.update' => ['PUT', '/pomodoro/presets/{preset}', [
                'name' => 'x', 'focus_minutes' => 25, 'break_minutes' => 5,
            ]],
            'web preset.destroy' => ['DELETE', '/pomodoro/presets/{preset}', []],
            'web pomodoro.sessions.destroy' => ['DELETE', '/pomodoro/sessions/{pomodoroSession}', []],

            'web watchlist.destroy' => ['DELETE', '/watchlist/{watchList}', []],
            'web watchlist.items.update' => ['PUT', '/watchlist/items/{watchListItem}', ['done' => true]],
            'web watchlist.items.destroy' => ['DELETE', '/watchlist/items/{watchListItem}', []],

            'web workouts.edit' => ['GET', '/workouts/{workout}/edit', []],
            'web workouts.update' => ['PUT', '/workouts/{workout}', ['activity' => 'x']],
            'web workouts.destroy' => ['DELETE', '/workouts/{workout}', []],

            'web workout-presets.destroy' => ['DELETE', '/workouts/presets/{workoutPreset}', []],

            // Fitness tracking (issue #4). Payloads are valid enough to reach
            // the ownership check: a write rejected by validation first would
            // 422 rather than 404 and would prove nothing.
            'web exercises.history' => ['GET', '/workouts/exercises/{exercise}/history', []],
            'web exercises.update' => ['PUT', '/workouts/exercises/{exercise}', ['name' => 'x']],
            'web exercises.destroy' => ['DELETE', '/workouts/exercises/{exercise}', []],
            'web routines.update' => ['PUT', '/workouts/routines/{routine}', ['name' => 'x']],
            'web routines.destroy' => ['DELETE', '/workouts/routines/{routine}', []],
            'web workout-sessions.update' => ['PUT', '/workouts/sessions/{session}', ['notes' => 'x']],
            'web workout-sessions.finish' => ['POST', '/workouts/sessions/{session}/finish', []],
            'web workout-sessions.destroy' => ['DELETE', '/workouts/sessions/{session}', []],
            'web workout-sets.store' => ['POST', '/workouts/sessions/{session}/sets', [
                'exercise_id' => '{sharedExercise}', 'reps' => 5,
            ]],
            'web workout-sets.update' => ['PUT', '/workouts/sets/{set}', ['reps' => 6]],
            'web workout-sets.destroy' => ['DELETE', '/workouts/sets/{set}', []],
            'web body-metrics.update' => ['PUT', '/workouts/body/{metric}', ['weight_grams' => 81000]],
            'web body-metrics.destroy' => ['DELETE', '/workouts/body/{metric}', []],
            'web progress-photos.file' => ['GET', '/workouts/photos/{photo}/file', []],
            'web progress-photos.destroy' => ['DELETE', '/workouts/photos/{photo}', []],

            'web history.destroy' => ['DELETE', '/history/{history}', []],

            'web budget.accounts.update' => ['PUT', '/budget/accounts/{account}', ['name' => 'renamed']],
            'web budget.accounts.destroy' => ['DELETE', '/budget/accounts/{account}', []],
            'web budget.transactions.destroy' => ['DELETE', '/budget/transactions/{transaction}', []],

            'web recurring.update' => ['PUT', '/budget/recurring/{recurring}', ['active' => false]],
            'web recurring.destroy' => ['DELETE', '/budget/recurring/{recurring}', []],

            // ── API ───────────────────────────────────────────────────────
            'api notes.show' => ['GET', '/api/v1/notes/{note}', []],
            'api notes.update' => ['PUT', '/api/v1/notes/{note}', ['title' => 'x']],
            'api notes.destroy' => ['DELETE', '/api/v1/notes/{note}', []],

            'api presets.show' => ['GET', '/api/v1/pomodoro-presets/{preset}', []],
            'api presets.update' => ['PUT', '/api/v1/pomodoro-presets/{preset}', [
                'name' => 'x', 'focus_minutes' => 25, 'break_minutes' => 5,
            ]],
            'api presets.destroy' => ['DELETE', '/api/v1/pomodoro-presets/{preset}', []],

            'api pomodoro-sessions.show' => ['GET', '/api/v1/pomodoro-sessions/{pomodoroSession}', []],
            'api pomodoro-sessions.destroy' => ['DELETE', '/api/v1/pomodoro-sessions/{pomodoroSession}', []],

            'api watchlist.show' => ['GET', '/api/v1/watch-lists/{watchList}', []],
            'api watchlist.update' => ['PUT', '/api/v1/watch-lists/{watchList}', ['name' => 'renamed']],
            'api watchlist.destroy' => ['DELETE', '/api/v1/watch-lists/{watchList}', []],
            'api watchlist.items.update' => ['PUT', '/api/v1/watch-list-items/{watchListItem}', ['done' => true]],
            'api watchlist.items.destroy' => ['DELETE', '/api/v1/watch-list-items/{watchListItem}', []],

            'api workouts.show' => ['GET', '/api/v1/workout-entries/{workout}', []],
            'api workouts.update' => ['PUT', '/api/v1/workout-entries/{workout}', ['activity' => 'x']],
            'api workouts.destroy' => ['DELETE', '/api/v1/workout-entries/{workout}', []],

            'api workout-presets.destroy' => ['DELETE', '/api/v1/workout-presets/{workoutPreset}', []],

            'api exercises.show' => ['GET', '/api/v1/exercises/{exercise}', []],
            'api exercises.history' => ['GET', '/api/v1/exercises/{exercise}/history', []],
            'api exercises.update' => ['PUT', '/api/v1/exercises/{exercise}', ['name' => 'x']],
            'api exercises.destroy' => ['DELETE', '/api/v1/exercises/{exercise}', []],
            'api routines.show' => ['GET', '/api/v1/workout-routines/{routine}', []],
            'api routines.update' => ['PUT', '/api/v1/workout-routines/{routine}', ['name' => 'x']],
            'api routines.destroy' => ['DELETE', '/api/v1/workout-routines/{routine}', []],
            'api workout-sessions.show' => ['GET', '/api/v1/workout-sessions/{session}', []],
            'api workout-sessions.update' => ['PUT', '/api/v1/workout-sessions/{session}', ['notes' => 'x']],
            'api workout-sessions.finish' => ['POST', '/api/v1/workout-sessions/{session}/finish', []],
            'api workout-sessions.destroy' => ['DELETE', '/api/v1/workout-sessions/{session}', []],
            'api workout-sets.index' => ['GET', '/api/v1/workout-sessions/{session}/sets', []],
            'api workout-sets.store' => ['POST', '/api/v1/workout-sessions/{session}/sets', [
                'exercise_id' => '{sharedExercise}', 'reps' => 5,
            ]],
            'api workout-sets.update' => ['PUT', '/api/v1/workout-sets/{set}', ['reps' => 6]],
            'api workout-sets.destroy' => ['DELETE', '/api/v1/workout-sets/{set}', []],
            'api body-metrics.show' => ['GET', '/api/v1/body-metrics/{metric}', []],
            'api body-metrics.update' => ['PUT', '/api/v1/body-metrics/{metric}', ['weight_grams' => 81000]],
            'api body-metrics.destroy' => ['DELETE', '/api/v1/body-metrics/{metric}', []],
            'api progress-photos.file' => ['GET', '/api/v1/progress-photos/{photo}/file', []],
            'api progress-photos.destroy' => ['DELETE', '/api/v1/progress-photos/{photo}', []],

            'api history.show' => ['GET', '/api/v1/history-entries/{history}', []],
            'api history.destroy' => ['DELETE', '/api/v1/history-entries/{history}', []],

            'api accounts.show' => ['GET', '/api/v1/budget-accounts/{account}', []],
            'api accounts.update' => ['PUT', '/api/v1/budget-accounts/{account}', ['name' => 'renamed']],
            'api accounts.destroy' => ['DELETE', '/api/v1/budget-accounts/{account}', []],

            'api transactions.destroy' => ['DELETE', '/api/v1/budget-transactions/{transaction}', []],

            'api recurring.show' => ['GET', '/api/v1/recurring-transactions/{recurring}', []],
            'api recurring.update' => ['PUT', '/api/v1/recurring-transactions/{recurring}', ['active' => false]],
            'api recurring.destroy' => ['DELETE', '/api/v1/recurring-transactions/{recurring}', []],
        ];
    }

    #[DataProvider('tenantOwnedEndpoints')]
    public function test_another_users_record_is_not_reachable(string $method, string $template, array $payload): void
    {
        $uri = $this->resolve($template);
        $payload = $this->resolvePayload($payload);

        $response = str_starts_with($template, '/api/')
            ? $this->actingAsApi($this->attacker)->json($method, $uri, $payload)
            : $this->actingAs($this->attacker)->call($method, $uri, $payload);

        $this->assertSame(
            404,
            $response->getStatusCode(),
            "{$method} {$template} returned {$response->getStatusCode()}; a non-owner must get 404 "
                .'(403 would confirm the record exists)',
        );
    }

    #[DataProvider('tenantOwnedEndpoints')]
    public function test_the_owner_can_still_reach_their_own_record(string $method, string $template, array $payload): void
    {
        $uri = $this->resolve($template);
        $payload = $this->resolvePayload($payload);

        $response = str_starts_with($template, '/api/')
            ? $this->actingAsApi($this->victim)->json($method, $uri, $payload)
            : $this->actingAs($this->victim)->call($method, $uri, $payload);

        // Proves the 404 above comes from ownership and not from a broken
        // route, a bad fixture or failing validation.
        $this->assertNotSame(
            404,
            $response->getStatusCode(),
            "{$method} {$template} 404'd for the owner, so the isolation test above proves nothing",
        );
        $this->assertLessThan(
            500,
            $response->getStatusCode(),
            "{$method} {$template} errored for the owner with {$response->getStatusCode()}",
        );
    }

    public function test_index_routes_never_list_another_users_records(): void
    {
        $endpoints = [
            '/api/v1/notes',
            '/api/v1/pomodoro-presets',
            '/api/v1/pomodoro-sessions',
            '/api/v1/watch-lists',
            '/api/v1/watch-list-items',
            '/api/v1/workout-entries',
            '/api/v1/workout-presets',
            '/api/v1/history-entries',
            '/api/v1/budget-accounts',
            '/api/v1/budget-transactions',
            '/api/v1/recurring-transactions',
            '/api/v1/workout-routines',
            '/api/v1/workout-sessions',
            '/api/v1/body-metrics',
            '/api/v1/progress-photos',
        ];

        // Deliberately absent: /api/v1/exercises. It is the one list that is
        // *supposed* to return rows the caller does not own - the seeded
        // catalog belongs to nobody and is readable by everybody - so an
        // empty-list assertion would be asserting a bug.

        foreach ($endpoints as $endpoint) {
            $response = $this->actingAsApi($this->attacker)->getJson($endpoint);
            $response->assertOk();

            $this->assertSame(
                [],
                $response->json('data'),
                "{$endpoint} leaked rows to a user who owns none",
            );
        }
    }

    /**
     * Fails when a model-bound route is added without an isolation case above,
     * so the sweep cannot silently fall behind the router.
     */
    public function test_every_model_bound_route_is_covered(): void
    {
        $covered = [];
        foreach (self::tenantOwnedEndpoints() as [$method, $template]) {
            $covered[] = $method.' '.ltrim($template, '/');
        }

        $uncovered = [];

        foreach (Route::getRoutes() as $route) {
            /** @var RoutingRoute $route */
            if (! $this->isTenantOwnedRoute($route)) {
                continue;
            }

            foreach ($route->methods() as $method) {
                if (in_array($method, ['HEAD', 'PATCH'], true)) {
                    continue;
                }
                if (! in_array($method.' '.$route->uri(), $covered, true)) {
                    $uncovered[] = $method.' '.$route->uri();
                }
            }
        }

        $this->assertSame(
            [],
            $uncovered,
            "These model-bound routes have no cross-tenant test:\n  ".implode("\n  ", $uncovered),
        );
    }

    /** A route is in scope when it binds one of the per-user models. */
    private function isTenantOwnedRoute(RoutingRoute $route): bool
    {
        $parameters = $route->parameterNames();
        if ($parameters === []) {
            return false;
        }

        return array_intersect($parameters, array_keys($this->victimRecords)) !== [];
    }

    /** A photo row with an actual file on the faked disk behind it. */
    private function photoWithAFile(): ProgressPhoto
    {
        $photo = ProgressPhoto::factory()->for($this->victim)->create();

        Storage::disk($photo->disk)->put($photo->path, 'not really a jpeg');

        return $photo;
    }

    /**
     * The same `{fixture}` substitution the URI gets, applied to a payload.
     *
     * A write that references another record - a set naming its exercise -
     * would otherwise fail validation on a made-up id and 422 before the
     * ownership check ever ran, which would make the 404 assertion
     * meaningless.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function resolvePayload(array $payload): array
    {
        return array_map(function (mixed $value): mixed {
            if ($value === '{sharedExercise}') {
                return $this->sharedExercise->getKey();
            }

            return is_string($value) && str_starts_with($value, '{')
                ? $this->resolve($value)
                : $value;
        }, $payload);
    }

    private function resolve(string $template): string
    {
        return preg_replace_callback('/\{(\w+)\}/', function (array $matches): string {
            $record = $this->victimRecords[$matches[1]]
                ?? $this->fail("no fixture for route parameter '{$matches[1]}'");

            return (string) $record->getKey();
        }, $template);
    }

    private function actingAsApi(User $user): static
    {
        Sanctum::actingAs($user);

        return $this;
    }
}
