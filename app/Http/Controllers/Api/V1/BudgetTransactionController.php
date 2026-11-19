<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\BudgetTransactionType;
use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetTransactionRequest;
use App\Http\Resources\BudgetTransactionPayload;
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
        $transactions = $request->user()
            ->budgetTransactions()
            ->with(['account:id,name', 'relatedAccount:id,name', 'category:id,name', 'receipt'])
            ->orderByDesc('occurred_on')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => BudgetTransactionPayload::collection($transactions, BudgetTransactionPayload::API_FILE_ROUTE),
        ]);
    }

    public function store(BudgetTransactionRequest $request): JsonResponse
    {
        $type = $request->string('type')->value();
        $arguments = [
            $request->user(),
            $request->account(),
            $request->amountCents(),
            $request->input('description'),
            $request->occurredOn(),
            $request->merchant(),
            $request->categoryId(),
        ];

        $transaction = $type === BudgetTransactionType::Deposit->value
            ? $this->budget->deposit(...$arguments)
            : $this->budget->withdraw(...$arguments);

        $transaction->load(['account:id,name', 'category:id,name', 'receipt']);

        return response()->json([
            'data' => BudgetTransactionPayload::from($transaction, BudgetTransactionPayload::API_FILE_ROUTE),
        ], 201);
    }

    public function destroy(BudgetTransaction $transaction): JsonResponse
    {
        $this->authorizeOwned('delete', $transaction);

        $this->budget->deleteTransaction($transaction);

        return response()->json(status: 204);
    }
}
