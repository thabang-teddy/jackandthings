<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Whether a category collects spending or income.
 *
 * Limits only make sense on expense categories, and reports separate the two,
 * so the distinction is stored rather than inferred from the transaction.
 */
enum BudgetCategoryKind: string
{
    case Expense = 'expense';
    case Income = 'income';

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function allowsType(BudgetTransactionType $type): bool
    {
        return $this === self::Income
            ? $type->isCredit()
            : ! $type->isCredit();
    }
}
