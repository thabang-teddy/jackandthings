<?php

declare(strict_types=1);

namespace Tests\Feature\Security;

use App\Models\BudgetAccount;
use App\Models\HistoryEntry;
use App\Models\Note;
use App\Models\PomodoroPreset;
use App\Models\RecurringTransaction;
use App\Models\User;
use App\Models\WatchList;
use App\Models\WatchListItem;
use App\Models\WorkoutEntry;
use App\Models\WorkoutPreset;
use App\Services\BudgetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;
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

    private User $victim;

    private User $attacker;

    protected function setUp(): void
    {
        parent::setUp();

        $this->victim = User::factory()->create();
        $this->attacker = User::factory()->create();
        $this->buildVictimFixture();
    }

    private function buildVictimFixture(): void
    {
        $account = BudgetAccount::factory()->for($this->victim)->create(['name' => 'Victim cash']);
        $other = BudgetAccount::factory()->for($this->victim)->create(['name' => 'Victim savings']);

        $budget = app(BudgetService::class);
        $budget->deposit($this->victim, $account, 50_000, 'seed');
        $transaction = $this->victim->budgetTransactions()->latest()->firstOrFail();

        $this->victimRecords = [
            'note' => Note::factory()->for($this->victim)->create(),
            'preset' => PomodoroPreset::factory()->for($this->victim)->create(),
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

            'web watchlist.destroy' => ['DELETE', '/watchlist/{watchList}', []],
            'web watchlist.items.update' => ['PUT', '/watchlist/items/{watchListItem}', ['done' => true]],
            'web watchlist.items.destroy' => ['DELETE', '/watchlist/items/{watchListItem}', []],

            'web workouts.edit' => ['GET', '/workouts/{workout}/edit', []],
            'web workouts.update' => ['PUT', '/workouts/{workout}', ['activity' => 'x']],
            'web workouts.destroy' => ['DELETE', '/workouts/{workout}', []],

            'web workout-presets.destroy' => ['DELETE', '/workouts/presets/{workoutPreset}', []],

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

            'api watchlist.show' => ['GET', '/api/v1/watch-lists/{watchList}', []],
            'api watchlist.update' => ['PUT', '/api/v1/watch-lists/{watchList}', ['name' => 'renamed']],
            'api watchlist.destroy' => ['DELETE', '/api/v1/watch-lists/{watchList}', []],
            'api watchlist.items.update' => ['PUT', '/api/v1/watch-list-items/{watchListItem}', ['done' => true]],
            'api watchlist.items.destroy' => ['DELETE', '/api/v1/watch-list-items/{watchListItem}', []],

            'api workouts.show' => ['GET', '/api/v1/workout-entries/{workout}', []],
            'api workouts.update' => ['PUT', '/api/v1/workout-entries/{workout}', ['activity' => 'x']],
            'api workouts.destroy' => ['DELETE', '/api/v1/workout-entries/{workout}', []],

            'api workout-presets.destroy' => ['DELETE', '/api/v1/workout-presets/{workoutPreset}', []],

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
            '/api/v1/watch-lists',
            '/api/v1/watch-list-items',
            '/api/v1/workout-entries',
            '/api/v1/workout-presets',
            '/api/v1/history-entries',
            '/api/v1/budget-accounts',
            '/api/v1/budget-transactions',
            '/api/v1/recurring-transactions',
        ];

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
