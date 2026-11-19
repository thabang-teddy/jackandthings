<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetLimitRequest;
use App\Models\BudgetLimit;
use Illuminate\Http\RedirectResponse;

class BudgetLimitController extends Controller
{
    use AuthorizesOwnership;

    /**
     * One cap per category per month: submitting the form again for the same
     * month edits the existing cap instead of adding a second one.
     */
    public function store(BudgetLimitRequest $request): RedirectResponse
    {
        $period = $request->string('period')->value();

        $request->user()->budgetLimits()->updateOrCreate(
            [
                'category_id' => $request->string('category_id')->value(),
                'period' => $period,
            ],
            ['limit_cents' => $request->limitCents()],
        );

        return to_route('budget.limits', ['period' => $period])->with('status', 'Limit saved.');
    }

    public function update(BudgetLimitRequest $request, BudgetLimit $limit): RedirectResponse
    {
        $this->authorizeOwned('update', $limit);

        $limit->update($request->attributesForModel());

        return to_route('budget.limits', ['period' => $limit->period])->with('status', 'Limit updated.');
    }

    public function destroy(BudgetLimit $limit): RedirectResponse
    {
        $this->authorizeOwned('delete', $limit);

        $period = $limit->period;
        $limit->delete();

        return to_route('budget.limits', ['period' => $period])->with('status', 'Limit removed.');
    }
}
