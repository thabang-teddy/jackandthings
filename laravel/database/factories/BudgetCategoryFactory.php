<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\BudgetCategoryKind;
use App\Models\BudgetCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BudgetCategory>
 */
class BudgetCategoryFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'kind' => BudgetCategoryKind::Expense->value,
        ];
    }

    public function income(): static
    {
        return $this->state(fn (): array => ['kind' => BudgetCategoryKind::Income->value]);
    }
}
