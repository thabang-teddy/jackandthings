<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\NoteRequest;
use App\Models\Note;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NoteController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): Response
    {
        $notes = $request->user()->notes()
            ->latest()
            ->paginate(12)
            ->through(fn (Note $note): array => [
                'id' => $note->id,
                'title' => $note->title,
                'body' => $note->body,
                'updated_at' => $note->updated_at?->toIso8601String(),
            ]);

        return Inertia::render('Notes/Index', ['notes' => $notes]);
    }

    public function create(): Response
    {
        return Inertia::render('Notes/Form', ['note' => null]);
    }

    public function store(NoteRequest $request): RedirectResponse
    {
        $request->user()->notes()->create($request->validated());

        // The home page's quick-note popup saves without leaving the page;
        // every other create form still lands on the notes list.
        if ($request->input('return_to') === 'home') {
            return to_route('home')->with('status', 'Note saved.');
        }

        return to_route('notes.index')->with('status', 'Note saved.');
    }

    public function edit(Note $note): Response
    {
        $this->authorizeOwned('view', $note);

        return Inertia::render('Notes/Form', [
            'note' => [
                'id' => $note->id,
                'title' => $note->title,
                'body' => $note->body,
            ],
        ]);
    }

    public function update(NoteRequest $request, Note $note): RedirectResponse
    {
        $this->authorizeOwned('update', $note);

        $note->update($request->validated());

        // The home page's note popup edits in place; every other edit form
        // still lands on the notes list.
        if ($request->input('return_to') === 'home') {
            return to_route('home')->with('status', 'Note updated.');
        }

        return to_route('notes.index')->with('status', 'Note updated.');
    }

    public function destroy(Note $note): RedirectResponse
    {
        $this->authorizeOwned('delete', $note);

        $note->delete();

        return to_route('notes.index')->with('status', 'Note deleted.');
    }
}
