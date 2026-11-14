<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\WorkoutRoutine;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkoutRoutine>
 */
class WorkoutRoutineFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->randomElement(['Push day', 'Pull day', 'Leg day', 'Full body']),
            'notes' => fake()->optional()->sentence(),
        ];
    }
}
