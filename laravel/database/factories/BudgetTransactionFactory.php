<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\BudgetTransactionType;
use App\Models\BudgetTransaction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BudgetTransaction>
 */
class BudgetTransactionFactory extends Factory
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
        ];
    }
}
