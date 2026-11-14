<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutSetRequest;
use App\Http\Resources\WorkoutSetPayload;
use App\Models\WorkoutSession;
use App\Models\WorkoutSet;
use App\Services\WorkoutRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Sets logged against a session, one request per set as the workout happens.
 *
 * The reply carries `is_record`, so the client can flag a new personal best
 * the moment it is saved rather than making the user go and look.
 */
class WorkoutSetController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly WorkoutRecords $records) {}

    public function index(Request $request, WorkoutSession $session): JsonResponse
    {
        $this->authorizeOwned('view', $session);

        return response()->json([
            'data' => WorkoutSetPayload::collection($session->load('sets.exercise')->sets),
        ]);
    }

    /**
     * `position` is assigned here from the session's current set count rather
     * than accepted from the client, so two devices logging at once cannot
     * claim the same slot. The read and the insert share a transaction for the
     * same reason.
     */
    public function store(WorkoutSetRequest $request, WorkoutSession $session): JsonResponse
    {
        $this->authorizeOwned('update', $session);

        $set = DB::transaction(function () use ($request, $session): WorkoutSet {
            $attributes = $request->attributesForModel();
            $attributes['workout_session_id'] = $session->getKey();
            $attributes['position'] = (int) $session->sets()->max('position') + 1;

            return $request->user()->workoutSets()->create($attributes);
        });

        return response()->json([
            'data' => WorkoutSetPayload::from($set->load('exercise')),
            'is_record' => $this->records->isRecord($request->user(), $set),
        ], 201);
    }

    public function update(WorkoutSetRequest $request, WorkoutSet $set): JsonResponse
    {
        $this->authorizeOwned('update', $set);

        $set->update($request->attributesForModel());

        return response()->json([
            'data' => WorkoutSetPayload::from($set->load('exercise')),
            'is_record' => $this->records->isRecord($request->user(), $set),
        ]);
    }

    public function destroy(WorkoutSet $set): JsonResponse
    {
        $this->authorizeOwned('delete', $set);

        // The remaining positions are left as they are: they only have to
        // order the list, and renumbering would rewrite rows for no gain.
        $set->delete();

        return response()->json(status: 204);
    }
}
