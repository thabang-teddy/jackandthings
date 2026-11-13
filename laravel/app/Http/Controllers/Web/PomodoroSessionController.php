<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\PomodoroSessionRequest;
use App\Models\PomodoroSession;
use Illuminate\Http\RedirectResponse;

/**
 * Logs a finished interval from the web page, and lets one be deleted again.
 *
 * There is no update: a recorded interval is history, and the only honest
 * correction to "I did not really do that one" is to remove it.
 */
class PomodoroSessionController extends Controller
{
    use AuthorizesOwnership;

    public function store(PomodoroSessionRequest $request): RedirectResponse
    {
        $request->user()->pomodoroSessions()->create([
            ...$request->validated(),
            'source' => 'web',
        ]);

        // The page posts this from a timer callback, not a form submit, so it
        // only needs the refreshed analytics props back - no flash message.
        return to_route('pomodoro.index');
    }

    public function destroy(PomodoroSession $pomodoroSession): RedirectResponse
    {
        $this->authorizeOwned('delete', $pomodoroSession);

        $pomodoroSession->delete();

        return to_route('pomodoro.index')->with('status', 'Session removed.');
    }
}
