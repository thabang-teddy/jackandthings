<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetAccountRequest;
use App\Models\BudgetAccount;
use Illuminate\Http\RedirectResponse;

class BudgetAccountController extends Controller
{
    use AuthorizesOwnership;

    public function store(BudgetAccountRequest $request): RedirectResponse
    {
        $request->user()->budgetAccounts()->create($request->attributesForModel());

        return back()->with('status', 'Account added.');
    }

    public function update(BudgetAccountRequest $request, BudgetAccount $account): RedirectResponse
    {
        $this->authorizeOwned('update', $account);

        $account->update($request->attributesForModel());

        return back()->with('status', 'Account renamed.');
    }

    public function destroy(BudgetAccount $account): RedirectResponse
    {
        $this->authorizeOwned('delete', $account);

        // Transactions on this account cascade with it (see the migration).
        $account->delete();

        return back()->with('status', 'Account deleted.');
    }
}
