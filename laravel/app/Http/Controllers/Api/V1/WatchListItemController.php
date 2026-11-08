<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WatchListItemRequest;
use App\Models\WatchListItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WatchListItemController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->watchListItems()->latest()->limit(200)->get(),
        ]);
    }

    public function store(WatchListItemRequest $request): JsonResponse
    {
        $item = $request->user()->watchListItems()->create($request->attributesForModel());

        return response()->json(['data' => $item], 201);
    }

    public function update(WatchListItemRequest $request, WatchListItem $watchListItem): JsonResponse
    {
        $this->authorizeOwned('update', $watchListItem);

        $watchListItem->update($request->attributesForModel());

        return response()->json(['data' => $watchListItem]);
    }

    public function destroy(WatchListItem $watchListItem): JsonResponse
    {
        $this->authorizeOwned('delete', $watchListItem);

        $watchListItem->delete();

        return response()->json(status: 204);
    }
}
