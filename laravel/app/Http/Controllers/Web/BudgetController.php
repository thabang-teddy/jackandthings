<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\BudgetAccount;
use App\Models\BudgetTransaction;
use App\Models\RecurringTransaction;
use App\Models\User;
use App\Services\BudgetService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class BudgetController extends Controller
{
    public function __construct(private readonly BudgetService $budget) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Budget/Overview', [
            'accounts' => $this->accountsWithBalances($user),
            'transactions' => $this->recentTransactions($user, 25),
            'totalCents' => array_sum($this->budget->balancesFor($user)),
        ]);
    }

    public function cards(Request $request): Response
    {
        return Inertia::render('Budget/Cards', [
            'accounts' => $this->accountsWithBalances($request->user()),
        ]);
    }

    public function transfer(Request $request): Response
    {
        return Inertia::render('Budget/Transfer', [
            'accounts' => $this->accountsWithBalances($request->user()),
        ]);
    }

    public function transactions(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Budget/Transactions', [
            'accounts' => $this->accountsWithBalances($user),
            'transactions' => $this->recentTransactions($user, 50),
        ]);
    }

    public function recurring(Request $request): Response
    {
        $user = $request->user();

        $items = $user->recurringTransactions()
            ->with('account:id,name')
            ->orderBy('next_run_at')
            ->get()
            ->map(fn (RecurringTransaction $recurring): array => [
                'id' => $recurring->id,
                'account_id' => $recurring->account_id,
                'account' => $recurring->account?->name,
                'type' => $recurring->type->value,
                'amount_cents' => $recurring->amount_cents,
                'description' => $recurring->description,
                'cadence' => $recurring->cadence->value,
                'next_run_at' => $recurring->next_run_at?->toDateString(),
                'active' => $recurring->active,
            ]);

        return Inertia::render('Budget/Recurring', [
            'accounts' => $this->accountsWithBalances($user),
            'recurring' => $items,
        ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function accountsWithBalances(User $user)
    {
        $balances = $this->budget->balancesFor($user);

        return $user->budgetAccounts()
            ->orderBy('name')
            ->get()
            ->map(fn (BudgetAccount $account): array => [
                'id' => $account->id,
                'name' => $account->name,
                'balance_cents' => $balances[$account->id] ?? 0,
            ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function recentTransactions(User $user, int $limit)
    {
        return $user->budgetTransactions()
            ->with(['account:id,name', 'relatedAccount:id,name'])
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn (BudgetTransaction $transaction): array => [
                'id' => $transaction->id,
                'type' => $transaction->type->value,
                'amount_cents' => $transaction->amount_cents,
                'description' => $transaction->description,
                'account' => $transaction->account?->name,
                'related_account' => $transaction->relatedAccount?->name,
                'created_at' => $transaction->created_at?->toDayDateTimeString(),
            ]);
    }
}
