<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\HistoryEntry;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HistoryEntry>
 */
class HistoryEntryFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'url' => fake()->url(),
            'title' => fake()->sentence(4),
            'visited_at' => fake()->dateTimeBetween('-120 days', 'now'),
            'source' => 'seed',
        ];
    }

    /**
     * Older than any plausible retention window, for exercising history:prune.
     */
    public function stale(): self
    {
        return $this->state(fn (): array => [
            'visited_at' => fake()->dateTimeBetween('-400 days', '-200 days'),
        ]);
    }
}
