<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\PomodoroPreset;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PomodoroPreset>
 */
class PomodoroPresetFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->words(2, true),
            'focus_minutes' => fake()->randomElement([15, 25, 45, 50]),
            'break_minutes' => fake()->randomElement([5, 10, 15]),
        ];
    }
}
