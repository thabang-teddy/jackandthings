<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WatchListRequest;
use App\Models\WatchList;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The endpoint the Android app and browser add-ons use to sync the user's
 * watch lists. Items are a separate resource (WatchListItemController).
 */
class WatchListController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->watchLists()->with('items')->orderBy('name')->get(),
        ]);
    }

    public function store(WatchListRequest $request): JsonResponse
    {
        $list = $request->user()->watchLists()->create($request->validated());

        return response()->json(['data' => $list], 201);
    }

    public function show(WatchList $watchList): JsonResponse
    {
        $this->authorizeOwned('view', $watchList);

        return response()->json(['data' => $watchList->load('items')]);
    }

    public function update(WatchListRequest $request, WatchList $watchList): JsonResponse
    {
        $this->authorizeOwned('update', $watchList);

        $watchList->update($request->validated());

        return response()->json(['data' => $watchList]);
    }

    public function destroy(WatchList $watchList): JsonResponse
    {
        $this->authorizeOwned('delete', $watchList);

        $watchList->delete();

        return response()->json(status: 204);
    }
}
