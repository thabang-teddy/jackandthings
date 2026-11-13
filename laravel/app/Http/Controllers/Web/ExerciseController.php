<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\ExerciseRequest;
use App\Models\Exercise;
use Illuminate\Http\RedirectResponse;

/**
 * A user's own exercises. The seeded catalog is never written here -
 * ExercisePolicy refuses an update or a delete on a row with no owner, so the
 * library cannot be edited out from under everybody else.
 */
class ExerciseController extends Controller
{
    use AuthorizesOwnership;

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
