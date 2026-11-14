<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetGoalRequest;
use App\Http\Resources\BudgetGoalPayload;
use App\Models\BudgetGoal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetGoalController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): JsonResponse
    {
        $goals = $request->user()
            ->budgetGoals()
            ->with('account:id,name')
            ->orderBy('archived_at')
            ->orderBy('target_date')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => BudgetGoalPayload::collection($goals)]);
    }

    public function store(BudgetGoalRequest $request): JsonResponse
    {
        $goal = $request->user()->budgetGoals()->create($request->attributesForModel());

        return response()->json(['data' => BudgetGoalPayload::from($goal)], 201);
    }

    public function show(BudgetGoal $goal): JsonResponse
    {
        $this->authorizeOwned('view', $goal);

        return response()->json(['data' => BudgetGoalPayload::from($goal)]);
    }

    public function update(BudgetGoalRequest $request, BudgetGoal $goal): JsonResponse
    {
        $this->authorizeOwned('update', $goal);

        $goal->update($request->attributesForModel());

        return response()->json(['data' => BudgetGoalPayload::from($goal->refresh())]);
    }

    public function destroy(BudgetGoal $goal): JsonResponse
    {
        $this->authorizeOwned('delete', $goal);

        $goal->delete();

        return response()->json(status: 204);
    }
}
