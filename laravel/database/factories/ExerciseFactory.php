<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\ExerciseCategory;
use App\Enums\ExerciseMetric;
use App\Models\Exercise;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Exercise>
 */
class ExerciseFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'name' => ucfirst($name),
            'slug' => Str::slug($name),
            'category' => ExerciseCategory::Strength,
            'metric' => ExerciseMetric::WeightReps,
            'primary_muscle' => fake()->randomElement(['Chest', 'Quadriceps', 'Lats', 'Core']),
            'equipment' => fake()->randomElement(['Barbell', 'Dumbbell', 'Bodyweight', null]),
            'instructions' => fake()->optional()->sentence(),
            'cues' => [fake()->sentence(3)],
        ];
    }

    /**
     * A seeded catalog row - owned by nobody, readable by everybody, editable
     * by no one. `for($user)` would override this, so the state nulls the key
     * explicitly rather than relying on it being absent.
     */
    public function catalog(): static
    {
        return $this->state(fn (): array => ['user_id' => null]);
    }

    public function category(ExerciseCategory $category): static
    {
        return $this->state(fn (): array => ['category' => $category]);
    }

    public function metric(ExerciseMetric $metric): static
    {
        return $this->state(fn (): array => ['metric' => $metric]);
    }
}
