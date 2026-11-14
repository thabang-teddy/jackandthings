<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\BudgetGoal;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BudgetGoal>
 */
class BudgetGoalFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->words(3, true),
            'target_cents' => fake()->numberBetween(100_000, 2_000_000),
            'saved_cents' => 0,
            'target_date' => null,
        ];
    }
}
