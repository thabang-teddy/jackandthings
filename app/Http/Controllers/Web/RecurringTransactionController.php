<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\RecurringTransactionRequest;
use App\Models\RecurringTransaction;
use Illuminate\Http\RedirectResponse;

class RecurringTransactionController extends Controller
{
    use AuthorizesOwnership;

    public function store(RecurringTransactionRequest $request): RedirectResponse
    {
        $request->user()->recurringTransactions()->create($request->attributesForModel());

        return to_route('budget.recurring')->with('status', 'Recurring item scheduled.');
    }

    public function update(RecurringTransactionRequest $request, RecurringTransaction $recurring): RedirectResponse
    {
        $this->authorizeOwned('update', $recurring);

        $recurring->update($request->attributesForModel());

        return to_route('budget.recurring')->with('status', 'Recurring item updated.');
    }

    public function destroy(RecurringTransaction $recurring): RedirectResponse
    {
        $this->authorizeOwned('delete', $recurring);

        $recurring->delete();

        return to_route('budget.recurring')->with('status', 'Recurring item removed.');
    }
}
