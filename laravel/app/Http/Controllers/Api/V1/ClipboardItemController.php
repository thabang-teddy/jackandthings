<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\ClipboardItemRequest;
use App\Models\ClipboardItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The endpoint future Android/browser-extension clients use to push and pull
 * clipboard snippets for the authenticated user.
 */
class ClipboardItemController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->clipboardItems()->latest()->limit(100)->get(),
        ]);
    }

    public function store(ClipboardItemRequest $request): JsonResponse
    {
        $item = $request->user()->clipboardItems()->create($request->validated());

        return response()->json(['data' => $item], 201);
    }

    public function show(ClipboardItem $item): JsonResponse
    {
        $this->authorizeOwned('view', $item);

        return response()->json(['data' => $item]);
    }

    public function update(ClipboardItemRequest $request, ClipboardItem $item): JsonResponse
    {
        $this->authorizeOwned('update', $item);

        $item->update($request->validated());

        return response()->json(['data' => $item]);
    }

    public function destroy(ClipboardItem $item): JsonResponse
    {
        $this->authorizeOwned('delete', $item);

        $item->delete();

        return response()->json(status: 204);
    }
}
