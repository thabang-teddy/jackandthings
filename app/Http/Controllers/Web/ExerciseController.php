<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\ExerciseRequest;
use App\Models\Exercise;
use App\Services\WorkoutRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * A user's own exercises. The seeded catalog is never written here -
 * ExercisePolicy refuses an update or a delete on a row with no owner, so the
 * library cannot be edited out from under everybody else.
 */
class ExerciseController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly WorkoutRecords $records) {}

    /**
     * What the user did the last few times they trained this exercise.
     *
     * Fetched by the live set logger as the exercise changes rather than
     * shipped with the page: the whole point is to see last time's numbers
     * while deciding this set's, and preloading a history for all 44
     * exercises to show one of them would be absurd.
     *
     * `data` is null when they have never trained it, which the page shows as
     * "no history yet" rather than as zeroes.
     */
    public function history(Request $request, Exercise $exercise): JsonResponse
    {
        $this->authorizeOwned('view', $exercise);

        return response()->json([
            'data' => $this->records->lastPerformance($request->user(), $exercise),
        ]);
    }

    public function store(ExerciseRequest $request): RedirectResponse
    {
        $request->user()->exercises()->create($request->attributesForModel());

        return back()->with('status', 'Exercise saved.');
    }

    public function update(ExerciseRequest $request, Exercise $exercise): RedirectResponse
    {
        $this->authorizeOwned('update', $exercise);

        $exercise->update($request->attributesForModel());

        return back()->with('status', 'Exercise updated.');
    }

    /**
     * Refused while a routine or a logged set still references it. The foreign
     * keys are restrictive on purpose - emptying a routine or orphaning logged
     * sets would lose training history - so the reason is reported rather than
     * surfacing as a constraint violation.
     */
    public function destroy(Exercise $exercise): RedirectResponse
    {
        $this->authorizeOwned('delete', $exercise);

        if ($exercise->routineItems()->exists() || $exercise->sets()->exists()) {
            return back()->withErrors([
                'exercise' => 'That exercise is still used by a routine or a logged set.',
            ]);
        }

        $exercise->delete();

        return back()->with('status', 'Exercise deleted.');
    }
}
