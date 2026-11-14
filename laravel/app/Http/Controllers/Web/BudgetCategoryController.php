<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetCategoryRequest;
use App\Models\BudgetCategory;
use Illuminate\Http\RedirectResponse;

class BudgetCategoryController extends Controller
{
    use AuthorizesOwnership;

    public function store(BudgetCategoryRequest $request): RedirectResponse
    {
        $request->user()->budgetCategories()->create($request->validated());

        return to_route('budget.categories')->with('status', 'Category added.');
    }

    public function update(BudgetCategoryRequest $request, BudgetCategory $category): RedirectResponse
    {
        $this->authorizeOwned('update', $category);

        $category->update($request->validated());

        return to_route('budget.categories')->with('status', 'Category updated.');
    }

    public function destroy(BudgetCategory $category): RedirectResponse
    {
        $this->authorizeOwned('delete', $category);

        // Transactions keep their money and become uncategorized; limits on
        // this category cascade with it (see the migration).
        $category->delete();

        return to_route('budget.categories')->with('status', 'Category deleted.');
    }
}
