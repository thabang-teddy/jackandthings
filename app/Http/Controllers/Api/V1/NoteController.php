<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\NoteRequest;
use App\Models\Note;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;

class NoteController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): AnonymousResourceCollection
    {
        return JsonResource::collection(
            $request->user()->notes()->latest()->paginate(50)
        );
    }

    public function store(NoteRequest $request): JsonResponse
    {
        $note = $request->user()->notes()->create($request->attributesForModel());

        return response()->json(['data' => $note], 201);
    }

    public function show(Note $note): JsonResponse
    {
        $this->authorizeOwned('view', $note);

        return response()->json(['data' => $note]);
    }

    public function update(NoteRequest $request, Note $note): JsonResponse
    {
        $this->authorizeOwned('update', $note);

        $note->update($request->attributesForModel());

        return response()->json(['data' => $note]);
    }

    public function destroy(Note $note): JsonResponse
    {
        $this->authorizeOwned('delete', $note);

        $note->delete();

        return response()->json(status: 204);
    }
}
