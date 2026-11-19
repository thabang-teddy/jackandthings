<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\WatchList;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WatchList>
 */
class WatchListFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
        ];
    }
}
