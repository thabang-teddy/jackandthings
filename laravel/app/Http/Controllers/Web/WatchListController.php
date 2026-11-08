<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WatchListRequest;
use App\Models\WatchList;
use App\Models\WatchListItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WatchListController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): Response
    {
        $lists = $request->user()->watchLists()
            ->with(['items' => fn ($query) => $query->latest()])
            ->orderBy('name')
            ->get()
            ->map(fn (WatchList $list): array => [
                'id' => $list->id,
                'name' => $list->name,
                'items' => $list->items->map(fn (WatchListItem $item): array => [
                    'id' => $item->id,
                    'title' => $item->title,
                    'note' => $item->note,
                    'done' => $item->done,
                ]),
            ]);

        return Inertia::render('WatchList/Index', ['lists' => $lists]);
    }

    public function store(WatchListRequest $request): RedirectResponse
    {
        $request->user()->watchLists()->create($request->validated());

        return back()->with('status', 'List created.');
    }

    public function destroy(WatchList $watchList): RedirectResponse
    {
        $this->authorizeOwned('delete', $watchList);

        $watchList->delete();

        return back()->with('status', 'List deleted.');
    }
}
