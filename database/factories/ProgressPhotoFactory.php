<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ProgressPhoto;
use App\Services\ProgressPhotoStorage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProgressPhoto>
 *
 * Builds the *row* only. The file behind it is not written, so a test that
 * cares about the image has to put one on the fake disk itself - which is the
 * honest shape, since a row whose file is missing is a real state the download
 * action has to handle.
 */
class ProgressPhotoFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'disk' => ProgressPhotoStorage::DISK,
            'path' => 'progress-photos/test/'.fake()->uuid().'.jpg',
            'mime' => 'image/jpeg',
            'size_bytes' => fake()->numberBetween(50_000, 2_000_000),
            'taken_on' => fake()->dateTimeBetween('-60 days', 'now')->format('Y-m-d'),
            'caption' => fake()->optional()->words(2, true),
        ];
    }
}
