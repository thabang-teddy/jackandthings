<?php

declare(strict_types=1);

namespace App\Enums;

enum BudgetTransactionType: string
{
    case Deposit = 'deposit';
    case Withdrawal = 'withdrawal';
    case TransferIn = 'transfer_in';
    case TransferOut = 'transfer_out';

    /**
     * Types a user may post directly; transfer legs are only created by BudgetService.
     *
     * @return array<int, string>
     */
    public static function directValues(): array
    {
        return [self::Deposit->value, self::Withdrawal->value];
    }

    /**
     * @return array<int, string>
     */
    public static function creditValues(): array
    {
        return [self::Deposit->value, self::TransferIn->value];
    }

    /**
     * @return array<int, string>
     */
    public static function debitValues(): array
    {
        return [self::Withdrawal->value, self::TransferOut->value];
    }

    public function isCredit(): bool
    {
        return in_array($this->value, self::creditValues(), true);
    }
}
