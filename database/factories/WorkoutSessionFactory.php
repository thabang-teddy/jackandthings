<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\WorkoutSession;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<WorkoutSession>
 */
class WorkoutSessionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startedAt = fake()->dateTimeBetween('-14 days', '-1 hour');

        return [
            'routine_name' => fake()->optional()->randomElement(['Push day', 'Leg day']),
            'started_at' => $startedAt,
            'finished_at' => (clone $startedAt)->modify('+45 minutes'),
            'notes' => null,
        ];
    }

    /** Still running - what GET workout-sessions/current looks for. */
    public function open(): static
    {
        return $this->state(fn (): array => ['finished_at' => null]);
    }

    /** Pins the start so analytics assertions are deterministic. */
    public function startedAt(Carbon $startedAt, int $minutes = 45): static
    {
        return $this->state(fn (): array => [
            'started_at' => $startedAt,
            'finished_at' => $startedAt->copy()->addMinutes($minutes),
        ]);
    }
}
