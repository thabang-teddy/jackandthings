<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\BudgetTransactionType;
use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetTransactionRequest;
use App\Models\BudgetTransaction;
use App\Services\BudgetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetTransactionController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly BudgetService $budget) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->budgetTransactions()
                ->with(['account:id,name', 'relatedAccount:id,name'])
                ->latest()
                ->limit(100)
                ->get(),
        ]);
    }

    public function store(BudgetTransactionRequest $request): JsonResponse
    {
        $transaction = $request->string('type')->value() === BudgetTransactionType::Deposit->value
            ? $this->budget->deposit($request->user(), $request->account(), $request->amountCents(), $request->input('description'))
            : $this->budget->withdraw($request->user(), $request->account(), $request->amountCents(), $request->input('description'));

        return response()->json(['data' => $transaction], 201);
    }

    public function destroy(BudgetTransaction $transaction): JsonResponse
    {
        $this->authorizeOwned('delete', $transaction);

        $this->budget->deleteTransaction($transaction);

        return response()->json(status: 204);
    }
}
