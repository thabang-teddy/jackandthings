<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\WorkoutEntry;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkoutEntry>
 */
class WorkoutEntryFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'activity' => fake()->randomElement(['Run', 'Push-ups', 'Cycling', 'Gym session', 'Walk']),
            'logged_at' => fake()->dateTimeBetween('-14 days', 'now'),
            'notes' => fake()->optional()->sentence(),
        ];
    }
}
