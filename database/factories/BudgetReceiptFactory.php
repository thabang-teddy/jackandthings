<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\BudgetReceipt;
use App\Models\BudgetTransaction;
use App\Services\BudgetReceiptStorage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BudgetReceipt>
 *
 * Builds the row only. A test that downloads the image has to put a file on
 * the fake disk itself, as ProgressPhotoFactory's docblock explains.
 */
class BudgetReceiptFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'transaction_id' => BudgetTransaction::factory(),
            'disk' => BudgetReceiptStorage::DISK,
            'path' => 'budget-receipts/test/'.fake()->uuid().'.jpg',
            'mime' => 'image/jpeg',
            'size_bytes' => fake()->numberBetween(20_000, 1_000_000),
        ];
    }
}
