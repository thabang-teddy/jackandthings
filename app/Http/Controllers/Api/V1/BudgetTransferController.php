<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetTransferRequest;
use App\Services\BudgetService;
use Illuminate\Http\JsonResponse;

class BudgetTransferController extends Controller
{
    public function __construct(private readonly BudgetService $budget) {}

    public function store(BudgetTransferRequest $request): JsonResponse
    {
        $this->budget->transfer(
            $request->user(),
            $request->fromAccount(),
            $request->toAccount(),
            $request->amountCents(),
            $request->input('description'),
        );

        return response()->json(status: 204);
    }
}
