<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutRoutineRequest;
use App\Http\Resources\WorkoutRoutinePayload;
use App\Models\WorkoutRoutine;
use App\Services\WorkoutRoutineWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkoutRoutineController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly WorkoutRoutineWriter $writer) {}

    public function index(Request $request): JsonResponse
    {
        $routines = $request->user()
            ->workoutRoutines()
            ->with('items.exercise')
            ->oldest()
            ->get();

        return response()->json(['data' => WorkoutRoutinePayload::collection($routines)]);
    }

    public function show(WorkoutRoutine $routine): JsonResponse
    {
        $this->authorizeOwned('view', $routine);

        return response()->json([
            'data' => WorkoutRoutinePayload::from($routine->load('items.exercise')),
        ]);
    }

    public function store(WorkoutRoutineRequest $request): JsonResponse
    {
        $routine = $this->writer->create(
            $request->user(),
            $request->routineAttributes(),
            $request->itemAttributes(),
        );

        return response()->json(['data' => WorkoutRoutinePayload::from($routine)], 201);
    }

    /**
     * An update with no `items` key leaves the exercise list alone, so a
     * rename does not have to resend the whole routine.
     */
    public function update(WorkoutRoutineRequest $request, WorkoutRoutine $routine): JsonResponse
    {
        $this->authorizeOwned('update', $routine);

        $routine = $this->writer->update(
            $routine,
            $request->routineAttributes(),
            $request->has('items') ? $request->itemAttributes() : null,
        );

        return response()->json(['data' => WorkoutRoutinePayload::from($routine)]);
    }

    public function destroy(WorkoutRoutine $routine): JsonResponse
    {
        $this->authorizeOwned('delete', $routine);

        // Sessions already run from this routine keep their denormalised
        // routine_name and survive; see the migration.
        $routine->delete();

        return response()->json(status: 204);
    }
}
