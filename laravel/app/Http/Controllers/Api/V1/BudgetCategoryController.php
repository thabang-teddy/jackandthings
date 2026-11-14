<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetCategoryRequest;
use App\Http\Resources\BudgetCategoryPayload;
use App\Models\BudgetCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetCategoryController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        BudgetCategory::ensureSeeded($user);

        return response()->json([
            'data' => BudgetCategoryPayload::collection(
                $user->budgetCategories()->orderBy('kind')->orderBy('name')->get(),
            ),
        ]);
    }

    public function store(BudgetCategoryRequest $request): JsonResponse
    {
        $category = $request->user()->budgetCategories()->create($request->validated());

        return response()->json(['data' => BudgetCategoryPayload::from($category)], 201);
    }

    public function show(BudgetCategory $category): JsonResponse
    {
        $this->authorizeOwned('view', $category);

        return response()->json(['data' => BudgetCategoryPayload::from($category)]);
    }

    public function update(BudgetCategoryRequest $request, BudgetCategory $category): JsonResponse
    {
        $this->authorizeOwned('update', $category);

        $category->update($request->validated());

        return response()->json(['data' => BudgetCategoryPayload::from($category->refresh())]);
    }

    public function destroy(BudgetCategory $category): JsonResponse
    {
        $this->authorizeOwned('delete', $category);

        // Transactions keep their money and become uncategorized; limits on
        // this category cascade with it.
        $category->delete();

        return response()->json(status: 204);
    }
}
