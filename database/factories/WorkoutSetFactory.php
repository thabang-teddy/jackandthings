<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\WorkoutSet;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkoutSet>
 */
class WorkoutSetFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'position' => 1,
            'is_warmup' => false,
            'reps' => fake()->numberBetween(3, 12),
            // Kilograms would be a float; grams are what the schema stores.
            'weight_grams' => fake()->numberBetween(20_000, 120_000),
            'distance_metres' => null,
            'duration_seconds' => null,
            'rpe' => fake()->optional()->numberBetween(5, 10),
            'completed_at' => fake()->dateTimeBetween('-14 days', 'now'),
        ];
    }

    /** Logged, but never counted towards a record or towards volume. */
    public function warmup(): static
    {
        return $this->state(fn (): array => ['is_warmup' => true]);
    }

    /** A set with exact numbers, for asserting a record or a volume total. */
    public function lifting(int $weightGrams, int $reps): static
    {
        return $this->state(fn (): array => [
            'weight_grams' => $weightGrams,
            'reps' => $reps,
        ]);
    }

    /** A cardio set: distance and time, no load. */
    public function covering(int $metres, int $seconds): static
    {
        return $this->state(fn (): array => [
            'weight_grams' => null,
            'reps' => null,
            'distance_metres' => $metres,
            'duration_seconds' => $seconds,
        ]);
    }

    public function completedAt(\DateTimeInterface $at): static
    {
        return $this->state(fn (): array => ['completed_at' => $at]);
    }
}
