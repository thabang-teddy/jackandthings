<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutRoutineRequest;
use App\Models\WorkoutRoutine;
use App\Services\WorkoutRoutineWriter;
use Illuminate\Http\RedirectResponse;

class WorkoutRoutineController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly WorkoutRoutineWriter $writer) {}

    public function store(WorkoutRoutineRequest $request): RedirectResponse
    {
        $this->writer->create(
            $request->user(),
            $request->routineAttributes(),
            $request->itemAttributes(),
        );

        return back()->with('status', 'Routine saved.');
    }

    public function update(WorkoutRoutineRequest $request, WorkoutRoutine $routine): RedirectResponse
    {
        $this->authorizeOwned('update', $routine);

        $this->writer->update(
            $routine,
            $request->routineAttributes(),
            $request->has('items') ? $request->itemAttributes() : null,
        );

        return back()->with('status', 'Routine updated.');
    }

    public function destroy(WorkoutRoutine $routine): RedirectResponse
    {
        $this->authorizeOwned('delete', $routine);

        // Workouts already run from it survive, keeping their denormalised
        // routine_name - see the create_workout_sessions_table migration.
        $routine->delete();

        return back()->with('status', 'Routine deleted.');
    }
}
