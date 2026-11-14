<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Enums\BudgetTransactionType;
use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetTransactionRequest;
use App\Models\BudgetTransaction;
use App\Services\BudgetService;
use Illuminate\Http\RedirectResponse;

class BudgetTransactionController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly BudgetService $budget) {}

    public function store(BudgetTransactionRequest $request): RedirectResponse
    {
        $user = $request->user();
        $account = $request->account();
        $amountCents = $request->amountCents();
        $arguments = [
            $user,
            $account,
            $amountCents,
            $request->input('description'),
            $request->occurredOn(),
            $request->merchant(),
            $request->categoryId(),
        ];

        if ($request->string('type')->value() === BudgetTransactionType::Deposit->value) {
            $this->budget->deposit(...$arguments);
        } else {
            $this->budget->withdraw(...$arguments);
        }

        return back()->with('status', 'Transaction posted.');
    }

    public function destroy(BudgetTransaction $transaction): RedirectResponse
    {
        $this->authorizeOwned('delete', $transaction);

        // Removes the counterpart leg too when this is part of a transfer.
        $this->budget->deleteTransaction($transaction);

        return back()->with('status', 'Transaction removed.');
    }
}
