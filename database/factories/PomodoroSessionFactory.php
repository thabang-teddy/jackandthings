<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\PomodoroPhase;
use App\Models\PomodoroSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PomodoroSession>
 */
class PomodoroSessionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $minutes = fake()->randomElement([15, 25, 45, 50]);
        $startedAt = fake()->dateTimeBetween('-7 days', 'now');

        return [
            'preset_name' => fake()->words(2, true),
            'tag' => fake()->randomElement(['Studying', 'Coding', 'Reading', null]),
            'phase' => PomodoroPhase::Focus,
            'started_at' => $startedAt,
            'ended_at' => (clone $startedAt)->modify("+{$minutes} minutes"),
            'duration_seconds' => $minutes * 60,
            'completed' => true,
            'source' => fake()->randomElement(['web', 'android', 'extension']),
        ];
    }

    public function phase(PomodoroPhase $phase): static
    {
        return $this->state(fn (): array => ['phase' => $phase]);
    }

    public function abandoned(): static
    {
        return $this->state(fn (): array => ['completed' => false]);
    }

    /** Pins a session to a wall-clock start so analytics assertions are deterministic. */
    public function startedAt(\DateTimeInterface $startedAt, int $minutes = 25): static
    {
        return $this->state(fn (): array => [
            'started_at' => $startedAt,
            'ended_at' => (new \DateTimeImmutable($startedAt->format('c')))->modify("+{$minutes} minutes"),
            'duration_seconds' => $minutes * 60,
        ]);
    }
}
