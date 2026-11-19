<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetGoalRequest;
use App\Models\BudgetGoal;
use Illuminate\Http\RedirectResponse;

class BudgetGoalController extends Controller
{
    use AuthorizesOwnership;

    public function store(BudgetGoalRequest $request): RedirectResponse
    {
        $request->user()->budgetGoals()->create($request->attributesForModel());

        return to_route('budget.goals')->with('status', 'Goal added.');
    }

    public function update(BudgetGoalRequest $request, BudgetGoal $goal): RedirectResponse
    {
        $this->authorizeOwned('update', $goal);

        $goal->update($request->attributesForModel());

        return to_route('budget.goals')->with('status', 'Goal updated.');
    }

    public function destroy(BudgetGoal $goal): RedirectResponse
    {
        $this->authorizeOwned('delete', $goal);

        $goal->delete();

        return to_route('budget.goals')->with('status', 'Goal removed.');
    }
}
