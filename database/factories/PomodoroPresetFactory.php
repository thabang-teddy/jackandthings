<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\PomodoroAmbience;
use App\Enums\PomodoroSound;
use App\Enums\PomodoroTicking;
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
            'long_break_minutes' => fake()->randomElement([15, 20, 30]),
            'cycles_before_long_break' => fake()->randomElement([3, 4, 5]),
            'auto_start_breaks' => true,
            'auto_start_focus' => false,
            'tag' => fake()->randomElement(['Studying', 'Coding', 'Reading', null]),
            'alarm_sound' => PomodoroSound::Chime,
            'ticking_sound' => PomodoroTicking::None,
            'ambience' => PomodoroAmbience::None,
            'strict_mode' => false,
            'blocked_sites' => null,
        ];
    }

    public function strict(array $sites = ['news.ycombinator.com']): static
    {
        return $this->state(fn (): array => [
            'strict_mode' => true,
            'blocked_sites' => $sites,
        ]);
    }
}
