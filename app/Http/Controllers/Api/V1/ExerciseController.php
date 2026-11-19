<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\ExerciseRequest;
use App\Http\Resources\ExercisePayload;
use App\Models\Exercise;
use App\Services\WorkoutRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The exercise library: the seeded catalog plus the caller's own exercises.
 *
 * `index` lists both, through Exercise::visibleTo(). The write actions only
 * ever touch the caller's own rows - ExercisePolicy refuses an update or a
 * delete on a catalog row, so nobody can edit the library out from under
 * everybody else.
 */
class ExerciseController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly WorkoutRecords $records) {}

    public function index(Request $request): JsonResponse
    {
        $exercises = Exercise::query()
            ->visibleTo($request->user())
            ->orderBy('name')
            ->get();

        return response()->json(['data' => ExercisePayload::collection($exercises)]);
    }

    public function show(Exercise $exercise): JsonResponse
    {
        $this->authorizeOwned('view', $exercise);

        return response()->json(['data' => ExercisePayload::from($exercise)]);
    }

    /**
     * What the caller did the last few times they trained this exercise, plus
     * their best figures - the progressive-overload panel a live workout
     * shows. `data` is null when they have never logged it, which the clients
     * render as "no history yet" rather than as zeroes.
     */
    public function history(Request $request, Exercise $exercise): JsonResponse
    {
        $this->authorizeOwned('view', $exercise);

        return response()->json([
            'data' => $this->records->lastPerformance($request->user(), $exercise),
        ]);
    }

    public function store(ExerciseRequest $request): JsonResponse
    {
        $exercise = $request->user()->exercises()->create($request->attributesForModel());

        return response()->json(['data' => ExercisePayload::from($exercise)], 201);
    }

    public function update(ExerciseRequest $request, Exercise $exercise): JsonResponse
    {
        $this->authorizeOwned('update', $exercise);

        $exercise->update($request->attributesForModel());

        return response()->json(['data' => ExercisePayload::from($exercise)]);
    }

    /**
     * Refused while anything still references the exercise. The foreign keys
     * are restrictive on purpose - quietly emptying a routine, or orphaning
     * logged sets, would lose training history - so this reports the reason
     * as a 422 rather than letting a constraint surface as a 500.
     */
    public function destroy(Exercise $exercise): JsonResponse
    {
        $this->authorizeOwned('delete', $exercise);

        if ($exercise->routineItems()->exists() || $exercise->sets()->exists()) {
            return response()->json([
                'message' => 'That exercise is still used by a routine or a logged set.',
                'errors' => ['exercise' => ['That exercise is still used by a routine or a logged set.']],
            ], 422);
        }

        $exercise->delete();

        return response()->json(status: 204);
    }
}
