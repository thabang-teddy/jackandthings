<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Enums\BudgetCategoryKind;
use App\Models\BudgetCategory;

/** One spending or income bucket. */
final class BudgetCategoryPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(BudgetCategory $category): array
    {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'kind' => $category->kind->value,
            'kind_label' => $category->kind === BudgetCategoryKind::Income ? 'Income' : 'Expense',
        ];
    }

    /**
     * @param  iterable<BudgetCategory>  $categories
     * @return array<int, array<string, mixed>>
     */
    public static function collection(iterable $categories): array
    {
        $payload = [];
        foreach ($categories as $category) {
            $payload[] = self::from($category);
        }

        return $payload;
    }
}
