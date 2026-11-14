<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\BudgetTransaction;

/**
 * One ledger row. `category` and `receipt` ride along so a list page renders
 * without a lookup per row.
 */
final class BudgetTransactionPayload
{
    /** The session-guarded receipt route, for the Inertia pages. */
    public const WEB_FILE_ROUTE = 'budget-receipts.file';

    /** The token-guarded receipt route, for Android. */
    public const API_FILE_ROUTE = 'api.v1.budget-receipts.file';

    /**
     * @return array<string, mixed>
     */
    public static function from(BudgetTransaction $transaction, string $fileRoute = self::WEB_FILE_ROUTE): array
    {
        return [
            'id' => $transaction->id,
            'account_id' => $transaction->account_id,
            'account' => $transaction->account?->name,
            'related_account_id' => $transaction->related_account_id,
            'related_account' => $transaction->relatedAccount?->name,
            'category_id' => $transaction->category_id,
            'category' => $transaction->category?->name,
            'type' => $transaction->type->value,
            'amount_cents' => $transaction->amount_cents,
            'occurred_on' => $transaction->occurred_on?->toDateString(),
            'merchant' => $transaction->merchant,
            'description' => $transaction->description,
            'transfer_group_id' => $transaction->transfer_group_id,
            'receipt' => $transaction->receipt === null
                ? null
                : BudgetReceiptPayload::from($transaction->receipt, $fileRoute),
            'created_at' => $transaction->created_at?->toIso8601String(),
        ];
    }

    /**
     * @param  iterable<BudgetTransaction>  $transactions
     * @return array<int, array<string, mixed>>
     */
    public static function collection(iterable $transactions, string $fileRoute = self::WEB_FILE_ROUTE): array
    {
        $payload = [];
        foreach ($transactions as $transaction) {
            $payload[] = self::from($transaction, $fileRoute);
        }

        return $payload;
    }
}
