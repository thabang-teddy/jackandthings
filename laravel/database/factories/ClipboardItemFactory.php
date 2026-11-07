<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ClipboardItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ClipboardItem>
 */
class ClipboardItemFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => fake()->words(2, true),
            'content' => fake()->sentence(),
            'source_device' => null,
        ];
    }
}
