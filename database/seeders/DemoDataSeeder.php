<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use App\Services\BudgetService;
use Illuminate\Database\Seeder;

/**
 * Synthetic data for local development only — it gives the module pages (and
 * especially History, which has no real data source until the browser add-on
 * exists) something to display. Never run this against real user data.
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'test@example.com'],
            ['name' => 'Test User', 'password' => bcrypt('password')],
        );

        $user->pomodoroPresets()->createMany([
            ['name' => 'Classic 25/5', 'focus_minutes' => 25, 'break_minutes' => 5],
            ['name' => 'Deep work 50/10', 'focus_minutes' => 50, 'break_minutes' => 10],
        ]);

        $user->notes()->createMany([
            ['title' => 'Shopping list', 'body' => "Milk\nBread\nCoffee"],
            ['title' => 'Project idea', 'body' => 'Merge the small apps into one suite.'],
        ]);

        $watchList = $user->watchLists()->create(['name' => 'May watch list']);
        $watchList->items()->createMany([
            ['user_id' => $user->id, 'title' => 'Dune: Part Two'],
            ['user_id' => $user->id, 'title' => 'The Bear — season 3', 'done' => true],
        ]);

        $user->workoutEntries()->createMany([
            ['activity' => 'Morning run', 'logged_at' => now()->subDays(2), 'notes' => '5km easy'],
            ['activity' => 'Push-ups', 'logged_at' => now()->subHours(3), 'notes' => '3 x 20'],
        ]);

        // A mix of recent and stale rows so history:prune has something to remove.
        $user->historyEntries()->createMany([
            ['url' => 'https://laravel.com/docs', 'title' => 'Laravel docs', 'visited_at' => now()->subHours(5), 'source' => 'seed'],
            ['url' => 'https://react.dev', 'title' => 'React', 'visited_at' => now()->subDays(10), 'source' => 'seed'],
            ['url' => 'https://example.test/old-article', 'title' => 'Old article', 'visited_at' => now()->subDays(200), 'source' => 'seed'],
        ]);

        $cash = $user->budgetAccounts()->create(['name' => 'Cash']);
        $savings = $user->budgetAccounts()->create(['name' => 'Savings']);

        $budget = app(BudgetService::class);
        $budget->deposit($user, $cash, 500_000, 'Salary');
        $budget->withdraw($user, $cash, 32_550, 'Groceries');
        $budget->transfer($user, $cash, $savings, 100_000, 'Monthly saving');
    }
}
