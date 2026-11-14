<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutEntryRequest;
use App\Models\WorkoutEntry;
use App\Services\WorkoutReminderStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkoutEntryController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly WorkoutReminderStatus $reminderStatus) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->workoutEntries()->latest('logged_at')->limit(100)->get(),
        ]);
    }

    /**
     * Reminder state for a client to poll. This endpoint sends nothing: the
     * client decides whether to raise its own notification. Delivery from the
     * server is deliberately not built yet (see docs/PRD.md open decisions).
     */
    public function due(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => [
                'due' => $this->reminderStatus->isDue($user),
                'last_logged_at' => $this->reminderStatus->lastLoggedAt($user)?->toIso8601String(),
            ],
        ]);
    }

    public function store(WorkoutEntryRequest $request): JsonResponse
    {
        $entry = $request->user()->workoutEntries()->create($request->validatedWithDefaults());

        return response()->json(['data' => $entry], 201);
    }

    public function show(WorkoutEntry $workout): JsonResponse
    {
        $this->authorizeOwned('view', $workout);

        return response()->json(['data' => $workout]);
    }

    public function update(WorkoutEntryRequest $request, WorkoutEntry $workout): JsonResponse
    {
        $this->authorizeOwned('update', $workout);

        $workout->update($request->validatedWithDefaults());

        return response()->json(['data' => $workout]);
    }

    public function destroy(WorkoutEntry $workout): JsonResponse
    {
        $this->authorizeOwned('delete', $workout);

        $workout->delete();

        return response()->json(status: 204);
    }
}
