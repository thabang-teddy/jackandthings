<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\RecurringTransactionRequest;
use App\Models\RecurringTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecurringTransactionController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->recurringTransactions()
                ->with('account:id,name')
                ->orderBy('next_run_at')
                ->get(),
        ]);
    }

    public function store(RecurringTransactionRequest $request): JsonResponse
    {
        $recurring = $request->user()->recurringTransactions()->create($request->attributesForModel());

        return response()->json(['data' => $recurring], 201);
    }

    public function show(RecurringTransaction $recurring): JsonResponse
    {
        $this->authorizeOwned('view', $recurring);

        return response()->json(['data' => $recurring]);
    }

    public function update(RecurringTransactionRequest $request, RecurringTransaction $recurring): JsonResponse
    {
        $this->authorizeOwned('update', $recurring);

        $recurring->update($request->attributesForModel());

        return response()->json(['data' => $recurring]);
    }

    public function destroy(RecurringTransaction $recurring): JsonResponse
    {
        $this->authorizeOwned('delete', $recurring);

        $recurring->delete();

        return response()->json(status: 204);
    }
}
