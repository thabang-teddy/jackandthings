<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\HistoryEntryRequest;
use App\Models\HistoryEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The endpoint the future browser extension will use to report visited URLs and
 * to remove them again.
 */
class HistoryEntryController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->historyEntries()->latest('visited_at')->limit(200)->get(),
            'meta' => ['retention_days' => (int) config('history.retention_days')],
        ]);
    }

    public function store(HistoryEntryRequest $request): JsonResponse
    {
        $entry = $request->user()->historyEntries()->create($request->validatedWithDefaults());

        return response()->json(['data' => $entry], 201);
    }

    public function show(HistoryEntry $history): JsonResponse
    {
        $this->authorizeOwned('view', $history);

        return response()->json(['data' => $history]);
    }

    public function destroy(HistoryEntry $history): JsonResponse
    {
        $this->authorizeOwned('delete', $history);

        $history->delete();

        return response()->json(status: 204);
    }
}
