<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\BudgetCategory;
use App\Models\BudgetLimit;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<BudgetLimit>
 */
class BudgetLimitFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'category_id' => BudgetCategory::factory(),
            'period' => Carbon::now()->format('Y-m'),
            'limit_cents' => fake()->numberBetween(50_000, 500_000),
        ];
    }
}
