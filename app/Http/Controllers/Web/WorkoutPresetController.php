<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutPresetRequest;
use App\Models\WorkoutPreset;
use Illuminate\Http\RedirectResponse;

class WorkoutPresetController extends Controller
{
    use AuthorizesOwnership;

    public function store(WorkoutPresetRequest $request): RedirectResponse
    {
        $request->user()->workoutPresets()->create($request->validated());

        return back()->with('status', 'Preset saved.');
    }

    public function destroy(WorkoutPreset $workoutPreset): RedirectResponse
    {
        $this->authorizeOwned('delete', $workoutPreset);

        $workoutPreset->delete();

        return back()->with('status', 'Preset deleted.');
    }
}
