<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BudgetTransactionType;
use App\Exceptions\InsufficientFundsException;
use App\Models\BudgetAccount;
use App\Models\BudgetTransaction;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BudgetService
{
    /**
     * Balances for every one of the user's accounts, keyed by account id.
     *
     * Two grouped queries, not N: one for the opening figures and one for the
     * ledger totals. A user with twelve accounts costs the same as one with
     * two. Used by the dashboard so listing accounts is never N queries.
     *
     * @return array<string, int>
     */
    public function balancesFor(User $user): array
    {
        // One query: the ledger totals unioned with the non-zero opening
        // figures. Keeping it to a single round trip is what stops the
        // dashboard costing one query per account.
        $ledger = DB::table('budget_transactions')
            ->where('user_id', $user->getKey())
            ->selectRaw('account_id, type, SUM(amount_cents) as total')
            ->groupBy('account_id', 'type');

        $opening = DB::table('budget_accounts')
            ->where('user_id', $user->getKey())
            ->where('opening_balance_cents', '<>', 0)
            ->selectRaw("id as account_id, 'opening' as type, opening_balance_cents as total");

        $balances = [];

        foreach ($ledger->unionAll($opening)->get() as $row) {
            $accountId = (string) $row->account_id;
            $total = (int) $row->total;
            $credit = $row->type === 'opening'
                || in_array((string) $row->type, BudgetTransactionType::creditValues(), true);

            $balances[$accountId] ??= 0;
            $balances[$accountId] += $credit ? $total : -$total;
        }

        return $balances;
    }

    public function deposit(
        User $user,
        BudgetAccount $account,
        int $amountCents,
        ?string $description = null,
        ?string $occurredOn = null,
        ?string $merchant = null,
        ?string $categoryId = null,
    ): BudgetTransaction {
        return $this->post(
            $user,
            $account,
            BudgetTransactionType::Deposit,
            $amountCents,
            $description,
            $occurredOn,
            $merchant,
            $categoryId,
        );
    }

    public function withdraw(
        User $user,
        BudgetAccount $account,
        int $amountCents,
        ?string $description = null,
        ?string $occurredOn = null,
        ?string $merchant = null,
        ?string $categoryId = null,
    ): BudgetTransaction {
        $this->assertSufficientFunds($account, $amountCents);

        return $this->post(
            $user,
            $account,
            BudgetTransactionType::Withdrawal,
            $amountCents,
            $description,
            $occurredOn,
            $merchant,
            $categoryId,
        );
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
        ?string $occurredOn = null,
    ): void {
        $this->assertSufficientFunds($from, $amountCents);

        $groupId = (string) Str::uuid7();

        DB::transaction(function () use ($user, $from, $to, $amountCents, $description, $occurredOn, $groupId): void {
            $this->post($user, $from, BudgetTransactionType::TransferOut, $amountCents, $description, $occurredOn, null, null, $to, $groupId);
            $this->post($user, $to, BudgetTransactionType::TransferIn, $amountCents, $description, $occurredOn, null, null, $from, $groupId);
        });
    }

    /**
     * Deleting one leg of a transfer removes its counterpart too, so the ledger
     * never keeps a one-sided transfer. Any receipt files go first: the row's
     * cascade would delete the record and leave the image behind.
     */
    public function deleteTransaction(BudgetTransaction $transaction): void
    {
        $query = BudgetTransaction::query()->where('user_id', $transaction->user_id);

        if ($transaction->transfer_group_id === null) {
            $query->whereKey($transaction->getKey());
        } else {
            $query->where('transfer_group_id', $transaction->transfer_group_id);
        }

        $query->with('receipt')->get()->each(function (BudgetTransaction $row): void {
            $row->receipt?->deleteWithFile();
        });

        $query->delete();
    }

    private function post(
        User $user,
        BudgetAccount $account,
        BudgetTransactionType $type,
        int $amountCents,
        ?string $description,
        ?string $occurredOn = null,
        ?string $merchant = null,
        ?string $categoryId = null,
        ?BudgetAccount $relatedAccount = null,
        ?string $transferGroupId = null,
    ): BudgetTransaction {
        // Created through the relation so user_id comes from the authenticated
        // user and is never mass-assignable from request input.
        return $user->budgetTransactions()->create([
            'account_id' => $account->getKey(),
            'type' => $type->value,
            'occurred_on' => $occurredOn ?? Carbon::today()->toDateString(),
            'amount_cents' => $amountCents,
            'merchant' => $merchant,
            'category_id' => $categoryId,
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
