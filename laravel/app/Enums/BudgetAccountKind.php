<?php

declare(strict_types=1);

namespace App\Enums;

/** What a budget account represents. A label, not a behaviour: the ledger is the same for all four. */
enum BudgetAccountKind: string
{
    case Cash = 'cash';
    case Cheque = 'cheque';
    case CreditCard = 'credit_card';
    case EWallet = 'ewallet';

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Cash',
            self::Cheque => 'Cheque / bank',
            self::CreditCard => 'Credit card',
            self::EWallet => 'E-wallet',
        };
    }
}
