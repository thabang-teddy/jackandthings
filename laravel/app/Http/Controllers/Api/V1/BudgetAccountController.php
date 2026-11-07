<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetAccountRequest;
use App\Models\BudgetAccount;
use App\Services\BudgetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetAccountController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly BudgetService $budget) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $balances = $this->budget->balancesFor($user);

        $accounts = $user->budgetAccounts()
            ->orderBy('name')
            ->get()
            ->map(fn (BudgetAccount $account): array => [
                'id' => $account->id,
                'name' => $account->name,
                'balance_cents' => $balances[$account->id] ?? 0,
            ]);

        return response()->json(['data' => $accounts, 'meta' => ['currency' => 'ZAR']]);
    }

    public function store(BudgetAccountRequest $request): JsonResponse
    {
        $account = $request->user()->budgetAccounts()->create($request->validated());

        return response()->json(['data' => $account], 201);
    }

    public function show(BudgetAccount $account): JsonResponse
    {
        $this->authorizeOwned('view', $account);

        return response()->json([
            'data' => [
                'id' => $account->id,
                'name' => $account->name,
                'balance_cents' => $account->balanceCents(),
            ],
        ]);
    }

    public function update(BudgetAccountRequest $request, BudgetAccount $account): JsonResponse
    {
        $this->authorizeOwned('update', $account);

        $account->update($request->validated());

        return response()->json(['data' => $account]);
    }

    public function destroy(BudgetAccount $account): JsonResponse
    {
        $this->authorizeOwned('delete', $account);

        $account->delete();

        return response()->json(status: 204);
    }
}
