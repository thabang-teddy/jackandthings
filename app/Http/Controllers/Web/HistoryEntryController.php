<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\HistoryEntryRequest;
use App\Models\HistoryEntry;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class HistoryEntryController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): Response
    {
        $entries = $request->user()->historyEntries()
            ->latest('visited_at')
            ->paginate(20)
            ->through(fn (HistoryEntry $entry): array => [
                'id' => $entry->id,
                'url' => $entry->url,
                'title' => $entry->title,
                'source' => $entry->source,
                'visited_at' => $entry->visited_at?->toIso8601String(),
            ]);

        return Inertia::render('History/Index', [
            'entries' => $entries,
            // Surfaced so the placeholder nature of the retention window is
            // visible in the UI, not buried in config.
            'retentionDays' => (int) config('history.retention_days'),
        ]);
    }

    public function store(HistoryEntryRequest $request): RedirectResponse
    {
        $request->user()->historyEntries()->create($request->validatedWithDefaults());

        return to_route('history.index')->with('status', 'Entry added.');
    }

    public function destroy(HistoryEntry $history): RedirectResponse
    {
        $this->authorizeOwned('delete', $history);

        $history->delete();

        return to_route('history.index')->with('status', 'Entry deleted.');
    }
}
