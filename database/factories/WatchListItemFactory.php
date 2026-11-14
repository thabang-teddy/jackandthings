<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\WatchListItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WatchListItem>
 */
class WatchListItemFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => fake()->sentence(3),
            'note' => fake()->optional()->sentence(),
            'done' => false,
        ];
    }
}
