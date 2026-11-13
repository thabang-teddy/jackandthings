<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\PomodoroSessionRequest;
use App\Models\PomodoroSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Response;

/**
 * Logs a finished interval from the web page, and lets one be deleted again.
 *
 * There is no update: a recorded interval is history, and the only honest
 * correction to "I did not really do that one" is to remove it.
 */
class PomodoroSessionController extends Controller
{
    use AuthorizesOwnership;

    /**
     * Answers 204 rather than redirecting.
     *
     * The page posts this from a timer callback, not a form submit, so there
     * is nothing to flash and nowhere to send the user - and a redirect would
     * be actively wrong: an interval finishing while they were reading their
     * notes would navigate them to the Pomodoro page. This is the same
     * "the open page talks to the session guard directly" shape
     * `workouts/due` already uses; see resources/js/Lib/pomodoroSessionLog.js
     * for the other half.
     */
    public function store(PomodoroSessionRequest $request): Response
    {
        $request->user()->pomodoroSessions()->create([
            ...$request->validated(),
            'source' => 'web',
        ]);

        return response()->noContent();
    }

    public function destroy(PomodoroSession $pomodoroSession): RedirectResponse
    {
        $this->authorizeOwned('delete', $pomodoroSession);

        $pomodoroSession->delete();

        return to_route('pomodoro.sessions')->with('status', 'Session removed.');
    }
}
