<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutSessionRequest;
use App\Models\WorkoutRoutine;
use App\Models\WorkoutSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Starting, finishing and deleting a workout from the web pages.
 *
 * The countdown between sets is client-side and lives in
 * resources/js/Lib/useWorkoutSession.js; nothing here persists a running
 * timer, only the session it belongs to.
 */
class WorkoutSessionController extends Controller
{
    use AuthorizesOwnership;

    public function store(WorkoutSessionRequest $request): RedirectResponse
    {
        $attributes = $request->attributesForModel();
        $attributes['started_at'] = $request->startedAt();
        $attributes['routine_name'] = $this->routineNameFor($request);

        $request->user()->workoutSessions()->create($attributes);

        return back()->with('status', 'Workout started.');
    }

    public function update(WorkoutSessionRequest $request, WorkoutSession $session): RedirectResponse
    {
        $this->authorizeOwned('update', $session);

        $attributes = $request->attributesForModel();

        if ($request->has('workout_routine_id')) {
            $attributes['routine_name'] = $this->routineNameFor($request);
        }

        $session->update($attributes);

        return back()->with('status', 'Workout updated.');
    }

    /**
     * The server stamps the finishing time rather than taking it from the
     * client, so a stopwatch cannot drift into the stored record. Finishing an
     * already-finished session leaves the original time standing: the first
     * finish is the true one, and a repeated click must not move it.
     */
    public function finish(Request $request, WorkoutSession $session): RedirectResponse
    {
        $this->authorizeOwned('update', $session);

        if ($session->isOpen()) {
            $session->update(['finished_at' => now()]);
        }

        return back()->with('status', 'Workout finished.');
    }

    public function destroy(WorkoutSession $session): RedirectResponse
    {
        $this->authorizeOwned('delete', $session);

        // Its sets go with it, which is right: a deleted workout should not
        // leave its sets standing in the records.
        $session->delete();

        return back()->with('status', 'Workout deleted.');
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
