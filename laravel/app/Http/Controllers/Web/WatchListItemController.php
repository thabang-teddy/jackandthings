<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WatchListItemRequest;
use App\Models\WatchListItem;
use Illuminate\Http\RedirectResponse;

class WatchListItemController extends Controller
{
    use AuthorizesOwnership;

    public function store(WatchListItemRequest $request): RedirectResponse
    {
        $request->user()->watchListItems()->create($request->attributesForModel());

        return back()->with('status', 'Item added.');
    }

    public function update(WatchListItemRequest $request, WatchListItem $watchListItem): RedirectResponse
    {
        $this->authorizeOwned('update', $watchListItem);

        $watchListItem->update($request->attributesForModel());

        return back()->with('status', 'Item updated.');
    }

    public function destroy(WatchListItem $watchListItem): RedirectResponse
    {
        $this->authorizeOwned('delete', $watchListItem);

        $watchListItem->delete();

        return back()->with('status', 'Item removed.');
    }
}
