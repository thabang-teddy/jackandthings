<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetReceiptRequest;
use App\Http\Resources\BudgetReceiptPayload;
use App\Models\BudgetReceipt;
use App\Models\BudgetTransaction;
use App\Services\BudgetReceiptStorage;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Receipt images. `file` is the only route to one, and it authorizes `view`
 * before a byte is streamed - the same model ProgressPhotoController uses.
 */
class BudgetReceiptController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly BudgetReceiptStorage $storage) {}

    public function store(BudgetReceiptRequest $request, BudgetTransaction $transaction): JsonResponse
    {
        // `view`, not `update`: the transaction itself is never edited, and its
        // policy deliberately exposes no update ability. The receipt is a
        // separate row that belongs to this user.
        $this->authorizeOwned('view', $transaction);

        $receipt = $this->storage->store($request->user(), $transaction, $request->file('receipt'));

        return response()->json([
            'data' => BudgetReceiptPayload::from($receipt, BudgetReceiptPayload::API_FILE_ROUTE),
        ], 201);
    }

    public function file(BudgetReceipt $receipt): StreamedResponse
    {
        $this->authorizeOwned('view', $receipt);

        abort_unless($this->storage->exists($receipt), 404);

        return $this->storage->response($receipt);
    }

    public function destroy(BudgetReceipt $receipt): JsonResponse
    {
        $this->authorizeOwned('delete', $receipt);

        $receipt->deleteWithFile();

        return response()->json(status: 204);
    }
}
