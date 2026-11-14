<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutSetRequest;
use App\Models\WorkoutSession;
use App\Models\WorkoutSet;
use App\Services\WorkoutRecords;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class WorkoutSetController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly WorkoutRecords $records) {}

    /**
     * `position` is assigned from the session's current sets rather than taken
     * from the client, so logging from two devices at once cannot put two sets
     * in the same slot. The read and the insert share a transaction for the
     * same reason.
     */
    public function store(WorkoutSetRequest $request, WorkoutSession $session): RedirectResponse
    {
        $this->authorizeOwned('update', $session);

        $set = DB::transaction(function () use ($request, $session): WorkoutSet {
            $attributes = $request->attributesForModel();
            $attributes['workout_session_id'] = $session->getKey();
            $attributes['position'] = (int) $session->sets()->max('position') + 1;

            return $request->user()->workoutSets()->create($attributes);
        });

        // Flashed so the page can celebrate a new best immediately, rather
        // than making the user go to the stats page to find out.
        return back()->with(
            'status',
            $this->records->isRecord($request->user(), $set)
                ? 'Set logged - new personal record.'
                : 'Set logged.'
        );
    }

    public function update(WorkoutSetRequest $request, WorkoutSet $set): RedirectResponse
    {
        $this->authorizeOwned('update', $set);

        $set->update($request->attributesForModel());

        return back()->with('status', 'Set updated.');
    }

    public function destroy(WorkoutSet $set): RedirectResponse
    {
        $this->authorizeOwned('delete', $set);

        // The remaining positions are left alone: they only order the list,
        // and renumbering would rewrite rows for no gain.
        $set->delete();

        return back()->with('status', 'Set removed.');
    }
}
