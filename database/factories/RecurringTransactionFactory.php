<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\BudgetTransactionType;
use App\Enums\RecurringCadence;
use App\Models\RecurringTransaction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RecurringTransaction>
 */
class RecurringTransactionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => fake()->randomElement(BudgetTransactionType::directValues()),
            'amount_cents' => fake()->numberBetween(1000, 500000),
            'description' => fake()->optional()->words(3, true),
            'cadence' => fake()->randomElement(RecurringCadence::values()),
            'next_run_at' => fake()->dateTimeBetween('now', '+1 month')->format('Y-m-d'),
            'active' => true,
        ];
    }
}
