<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\BudgetAccount;

/** One wallet, with the balance the server derived from the ledger. */
final class BudgetAccountPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(BudgetAccount $account, int $balanceCents): array
    {
        return [
            'id' => $account->id,
            'name' => $account->name,
            'kind' => $account->kind->value,
            'kind_label' => $account->kind->label(),
            'opening_balance_cents' => $account->opening_balance_cents,
            'balance_cents' => $balanceCents,
            'archived_at' => $account->archived_at?->toIso8601String(),
        ];
    }

    /**
     * @param  iterable<BudgetAccount>  $accounts
     * @param  array<string, int>  $balances
     * @return array<int, array<string, mixed>>
     */
    public static function collection(iterable $accounts, array $balances): array
    {
        $payload = [];
        foreach ($accounts as $account) {
            $payload[] = self::from($account, $balances[$account->id] ?? 0);
        }

        return $payload;
    }
}
