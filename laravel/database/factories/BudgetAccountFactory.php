<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\BudgetAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BudgetAccount>
 */
class BudgetAccountFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->randomElement(['Cash', 'Cheque', 'Savings', 'Wallet']),
        ];
    }
}
