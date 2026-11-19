<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\BodyMetric;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BodyMetric>
 */
class BodyMetricFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'measured_on' => fake()->unique()->dateTimeBetween('-60 days', 'now')->format('Y-m-d'),
            'weight_grams' => fake()->numberBetween(60_000, 95_000),
            'body_fat_permille' => fake()->numberBetween(80, 300),
            'measurements' => ['waist' => fake()->numberBetween(700, 1000)],
            'notes' => null,
        ];
    }
}
