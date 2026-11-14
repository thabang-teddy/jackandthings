<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutSessionRequest;
use App\Http\Resources\WorkoutSessionPayload;
use App\Models\WorkoutRoutine;
use App\Models\WorkoutSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Workouts. A session is created when one starts and updated with a
 * `finished_at` when it ends; the sets logged against it are
 * WorkoutSetController's job.
 *
 * Unlike a Pomodoro interval, which is only written once it has already ended,
 * this row has to exist while the workout is still happening - the sets need
 * something to attach to. The countdown between sets is still client-side and
 * is never persisted anywhere.
 */
class WorkoutSessionController extends Controller
{
    use AuthorizesOwnership;

    /** Sessions returned before paging would be wanted. */
    private const RECENT = 50;

    public function index(Request $request): JsonResponse
    {
        $sessions = $request->user()
            ->workoutSessions()
            ->with('sets.exercise')
            ->latest('started_at')
            ->limit(self::RECENT)
            ->get();

        return response()->json(['data' => WorkoutSessionPayload::collection($sessions)]);
    }

    /**
     * The workout in progress, if there is one. Returns null rather than 404
     * when nothing is running: "no open session" is a normal answer to this
     * question, not an error.
     */
    public function current(Request $request): JsonResponse
    {
        $session = $request->user()
            ->workoutSessions()
            ->open()
            ->with('sets.exercise')
            ->latest('started_at')
            ->first();

        return response()->json([
            'data' => $session === null ? null : WorkoutSessionPayload::from($session),
        ]);
    }

    public function show(WorkoutSession $session): JsonResponse
    {
        $this->authorizeOwned('view', $session);

        return response()->json([
            'data' => WorkoutSessionPayload::from($session->load('sets.exercise')),
        ]);
    }

    public function store(WorkoutSessionRequest $request): JsonResponse
    {
        $attributes = $request->attributesForModel();
        $attributes['started_at'] = $request->startedAt();

        // Copied onto the session so the history still reads correctly after
        // the routine is renamed or deleted. Resolved through the user's own
        // relation, so an id belonging to somebody else finds nothing.
        $attributes['routine_name'] = $this->routineNameFor($request);

        $session = $request->user()->workoutSessions()->create($attributes);

        return response()->json([
            'data' => WorkoutSessionPayload::from($session->load('sets.exercise')),
        ], 201);
    }

    public function update(WorkoutSessionRequest $request, WorkoutSession $session): JsonResponse
    {
        $this->authorizeOwned('update', $session);

        $attributes = $request->attributesForModel();

        if ($request->has('workout_routine_id')) {
            $attributes['routine_name'] = $this->routineNameFor($request);
        }

        $session->update($attributes);

        return response()->json([
            'data' => WorkoutSessionPayload::from($session->load('sets.exercise')),
        ]);
    }

    /**
     * Closes the workout. Separate from `update` so a client can finish a
     * session without having to know the current time - the server stamps it,
     * which also stops a stopwatch drifting into the stored record.
     */
    public function finish(Request $request, WorkoutSession $session): JsonResponse
    {
        $this->authorizeOwned('update', $session);

        // Finishing an already-finished session leaves the original time
        // standing: the first finish is the true one, and a repeated tap on a
        // flaky connection must not move it.
        if ($session->isOpen()) {
            $session->update(['finished_at' => now()]);
        }

        return response()->json([
            'data' => WorkoutSessionPayload::from($session->load('sets.exercise')),
        ]);
    }

    public function destroy(WorkoutSession $session): JsonResponse
    {
        $this->authorizeOwned('delete', $session);

        // The sets go with it - the migration cascades - which is right: a
        // deleted workout should not leave its sets behind in the records.
        $session->delete();

        return response()->json(status: 204);
    }

    private function routineNameFor(WorkoutSessionRequest $request): ?string
    {
        $routineId = $request->input('workout_routine_id');

        if ($routineId === null) {
            return null;
        }

        /** @var WorkoutRoutine|null $routine */
        $routine = $request->user()->workoutRoutines()->whereKey($routineId)->first();

        return $routine?->name;
    }
}
