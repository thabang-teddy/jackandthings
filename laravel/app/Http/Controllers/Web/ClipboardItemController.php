<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\ClipboardItemRequest;
use App\Models\ClipboardItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ClipboardItemController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): Response
    {
        $items = $request->user()->clipboardItems()
            ->latest()
            ->paginate(15)
            ->through(fn (ClipboardItem $item): array => [
                'id' => $item->id,
                'title' => $item->title,
                'content' => $item->content,
                'source_device' => $item->source_device,
                'created_at' => $item->created_at?->toDayDateTimeString(),
            ]);

        return Inertia::render('Clipboard/Index', ['items' => $items]);
    }

    public function create(): Response
    {
        return Inertia::render('Clipboard/Form', ['item' => null]);
    }

    public function store(ClipboardItemRequest $request): RedirectResponse
    {
        $request->user()->clipboardItems()->create($request->validated());

        return to_route('clipboard.index')->with('status', 'Snippet saved.');
    }

    public function edit(ClipboardItem $item): Response
    {
        $this->authorizeOwned('view', $item);

        return Inertia::render('Clipboard/Form', [
            'item' => [
                'id' => $item->id,
                'title' => $item->title,
                'content' => $item->content,
            ],
        ]);
    }

    public function update(ClipboardItemRequest $request, ClipboardItem $item): RedirectResponse
    {
        $this->authorizeOwned('update', $item);

        $item->update($request->validated());

        return to_route('clipboard.index')->with('status', 'Snippet updated.');
    }

    public function destroy(ClipboardItem $item): RedirectResponse
    {
        $this->authorizeOwned('delete', $item);

        $item->delete();

        return to_route('clipboard.index')->with('status', 'Snippet deleted.');
    }
}
