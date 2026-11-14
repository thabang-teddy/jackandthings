<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetAccountRequest;
use App\Http\Resources\BudgetAccountPayload;
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
            ->orderBy('archived_at')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => BudgetAccountPayload::collection($accounts, $balances),
            'meta' => ['currency' => 'ZAR'],
        ]);
    }

    public function store(BudgetAccountRequest $request): JsonResponse
    {
        $account = $request->user()->budgetAccounts()->create($request->attributesForModel());

        // The database supplies `kind` and `opening_balance_cents` when the
        // caller omitted them, so re-read the row before building the payload.
        $account->refresh();

        return response()->json([
            'data' => BudgetAccountPayload::from($account, $account->balanceCents()),
        ], 201);
    }

    public function show(BudgetAccount $account): JsonResponse
    {
        $this->authorizeOwned('view', $account);

        return response()->json([
            'data' => BudgetAccountPayload::from($account, $account->balanceCents()),
        ]);
    }

    public function update(BudgetAccountRequest $request, BudgetAccount $account): JsonResponse
    {
        $this->authorizeOwned('update', $account);

        $account->update($request->attributesForModel());

        return response()->json([
            'data' => BudgetAccountPayload::from($account->refresh(), $account->balanceCents()),
        ]);
    }

    public function destroy(BudgetAccount $account): JsonResponse
    {
        $this->authorizeOwned('delete', $account);

        $account->delete();

        return response()->json(status: 204);
    }
}
