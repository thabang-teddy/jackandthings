<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\WorkoutPreset;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkoutPreset>
 */
class WorkoutPresetFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->words(2, true),
            'activity' => fake()->randomElement(['5km run', 'Push-ups', 'Gym session', 'Yoga']),
        ];
    }
}
