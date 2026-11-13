<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\PomodoroPresetRequest;
use App\Models\PomodoroPreset;
use Illuminate\Http\RedirectResponse;

class PomodoroPresetController extends Controller
{
    use AuthorizesOwnership;

    public function store(PomodoroPresetRequest $request): RedirectResponse
    {
        $request->user()->pomodoroPresets()->create($request->validated());

        return to_route('pomodoro.index')->with('status', 'Preset saved.');
    }

    public function update(PomodoroPresetRequest $request, PomodoroPreset $preset): RedirectResponse
    {
        $this->authorizeOwned('update', $preset);

        $preset->update($request->validated());

        return to_route('pomodoro.index')->with('status', 'Preset updated.');
    }

    /**
     * Deleting a preset leaves its logged sessions in place - the foreign key
     * is nullOnDelete and each row keeps its own `preset_name`, so last
     * month's focus hours do not vanish because a preset was tidied up.
     */
    public function destroy(PomodoroPreset $preset): RedirectResponse
    {
        $this->authorizeOwned('delete', $preset);

        $preset->delete();

        return to_route('pomodoro.index')->with('status', 'Preset deleted.');
    }
}
