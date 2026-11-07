<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\BudgetAccount;
use App\Models\BudgetTransaction;
use App\Services\BudgetService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BudgetController extends Controller
{
    public function __construct(private readonly BudgetService $budget) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        // One grouped query for every balance, so N accounts is not N queries.
        $balances = $this->budget->balancesFor($user);

        $accounts = $user->budgetAccounts()
            ->orderBy('name')
            ->get()
            ->map(fn (BudgetAccount $account): array => [
                'id' => $account->id,
                'name' => $account->name,
                'balance_cents' => $balances[$account->id] ?? 0,
            ]);

        $transactions = $user->budgetTransactions()
            ->with(['account:id,name', 'relatedAccount:id,name'])
            ->latest()
            ->limit(25)
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

        return Inertia::render('Budget/Dashboard', [
            'accounts' => $accounts,
            'transactions' => $transactions,
            'totalCents' => array_sum($accounts->pluck('balance_cents')->all()),
        ]);
    }
}
