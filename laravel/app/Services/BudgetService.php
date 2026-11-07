<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BudgetTransactionType;
use App\Exceptions\InsufficientFundsException;
use App\Models\BudgetAccount;
use App\Models\BudgetTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BudgetService
{
    /**
     * Balances for every one of the user's accounts in a single query, keyed by
     * account id. Used by the dashboard so listing N accounts is not N queries.
     *
     * @return array<string, int>
     */
    public function balancesFor(User $user): array
    {
        $rows = $user->budgetTransactions()
            ->selectRaw('account_id, type, SUM(amount_cents) as total')
            ->groupBy('account_id', 'type')
            ->get();

        $balances = [];

        foreach ($rows as $row) {
            $accountId = (string) $row->account_id;
            $total = (int) $row->total;

            $balances[$accountId] ??= 0;
            $balances[$accountId] += $row->type->isCredit() ? $total : -$total;
        }

        return $balances;
    }

    public function deposit(User $user, BudgetAccount $account, int $amountCents, ?string $description = null): BudgetTransaction
    {
        return $this->post($user, $account, BudgetTransactionType::Deposit, $amountCents, $description);
    }

    public function withdraw(User $user, BudgetAccount $account, int $amountCents, ?string $description = null): BudgetTransaction
    {
        $this->assertSufficientFunds($account, $amountCents);

        return $this->post($user, $account, BudgetTransactionType::Withdrawal, $amountCents, $description);
    }

    /**
     * Both legs of a transfer are written together under one transfer_group_id,
     * so a partial transfer can never be observed.
     */
    public function transfer(
        User $user,
        BudgetAccount $from,
        BudgetAccount $to,
        int $amountCents,
        ?string $description = null,
    ): void {
        $this->assertSufficientFunds($from, $amountCents);

        $groupId = (string) Str::uuid7();

        DB::transaction(function () use ($user, $from, $to, $amountCents, $description, $groupId): void {
            $this->post($user, $from, BudgetTransactionType::TransferOut, $amountCents, $description, $to, $groupId);
            $this->post($user, $to, BudgetTransactionType::TransferIn, $amountCents, $description, $from, $groupId);
        });
    }

    /**
     * Deleting one leg of a transfer removes its counterpart too, so the ledger
     * never keeps a one-sided transfer.
     */
    public function deleteTransaction(BudgetTransaction $transaction): void
    {
        if ($transaction->transfer_group_id === null) {
            $transaction->delete();

            return;
        }

        BudgetTransaction::query()
            ->where('user_id', $transaction->user_id)
            ->where('transfer_group_id', $transaction->transfer_group_id)
            ->delete();
    }

    private function post(
        User $user,
        BudgetAccount $account,
        BudgetTransactionType $type,
        int $amountCents,
        ?string $description,
        ?BudgetAccount $relatedAccount = null,
        ?string $transferGroupId = null,
    ): BudgetTransaction {
        // Created through the relation so user_id comes from the authenticated
        // user and is never mass-assignable from request input.
        return $user->budgetTransactions()->create([
            'account_id' => $account->getKey(),
            'type' => $type->value,
            'amount_cents' => $amountCents,
            'related_account_id' => $relatedAccount?->getKey(),
            'transfer_group_id' => $transferGroupId,
            'description' => $description,
        ]);
    }

    private function assertSufficientFunds(BudgetAccount $account, int $amountCents): void
    {
        $balance = $account->balanceCents();

        if ($balance < $amountCents) {
            throw InsufficientFundsException::forAccount($account->name, $balance, $amountCents);
        }
    }
}
