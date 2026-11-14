<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\BudgetTransactionType;
use App\Models\BudgetTransaction;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

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
            'occurred_on' => Carbon::today()->toDateString(),
            'amount_cents' => fake()->numberBetween(1000, 500000),
            'description' => fake()->optional()->words(3, true),
            'merchant' => fake()->optional()->company(),
        ];
    }
}
