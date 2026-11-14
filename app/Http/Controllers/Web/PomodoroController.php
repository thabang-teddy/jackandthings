<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Resources\PomodoroPresetPayload;
use App\Http\Resources\PomodoroSessionPayload;
use App\Models\User;
use App\Services\PomodoroAnalytics;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Pomodoro module's four pages: the timer, the presets, the session log
 * and the analytics.
 *
 * They were one page with four anchors until the module outgrew it - issue #3
 * turned a preset into fourteen fields and added a chart and a history list,
 * and scrolling past all of that to reach a countdown is not a timer. Each
 * action below loads only what its own page draws, so opening Presets does
 * not run the analytics query and opening the timer does not read the
 * session log.
 *
 * The countdown itself still runs client-side and is shared across every page
 * by PomodoroTimerProvider, so navigating between these four does not disturb
 * a running session.
 */
class PomodoroController extends Controller
{
    /** Sessions listed on the Sessions page before paging would be wanted. */
    private const RECENT_SESSIONS = 50;

    public function __construct(private readonly PomodoroAnalytics $analytics) {}

    /**
     * The timer. Carries the presets so the picker can start one, and today's
     * totals for the line under the clock - not the whole analytics payload,
     * which is a different page's job.
     */
    public function index(Request $request): Response
    {
        $user = $this->validatedUser($request);

        $analytics = $this->analytics->for($user, $this->timezone($request));

        return Inertia::render('Pomodoro/Index', [
            'presets' => PomodoroPresetPayload::collection($user->pomodoroPresets()->oldest()->get()),
            'today' => $analytics['today'],
            // Which zone the totals above were bucketed in, so the page can
            // tell whether its own zone was the one used.
            'timezone' => $analytics['timezone'],
        ]);
    }

    public function presets(Request $request): Response
    {
        $user = $this->validatedUser($request);

        return Inertia::render('Pomodoro/Presets', [
            'presets' => PomodoroPresetPayload::collection($user->pomodoroPresets()->oldest()->get()),
            // Tags already used, so the preset form can offer them back rather
            // than making the user retype "Studying" and spell it differently.
            'tags' => $this->tagsFor($user),
        ]);
    }

    public function sessions(Request $request): Response
    {
        $user = $this->validatedUser($request);

        $analytics = $this->analytics->for($user, $this->timezone($request));

        return Inertia::render('Pomodoro/Sessions', [
            'sessions' => PomodoroSessionPayload::collection(
                $user->pomodoroSessions()->latest('started_at')->limit(self::RECENT_SESSIONS)->get()
            ),
            'today' => $analytics['today'],
            'timezone' => $analytics['timezone'],
        ]);
    }

    public function stats(Request $request): Response
    {
        $user = $this->validatedUser($request);

        return Inertia::render('Pomodoro/Stats', [
            'analytics' => $this->analytics->for($user, $this->timezone($request)),
        ]);
    }

    /**
     * `tz` comes from the page (`Intl.DateTimeFormat().resolvedOptions()`)
     * because the server runs in UTC and would otherwise bucket an evening
     * session onto the wrong day. Validated on every action that reads it.
     */
    private function validatedUser(Request $request): User
    {
        $request->validate(['tz' => PomodoroAnalytics::REQUEST_TIMEZONE_RULE]);

        return $request->user();
    }

    private function timezone(Request $request): string
    {
        return $request->string('tz')->toString();
    }

    /**
     * @return array<int, string>
     */
    private function tagsFor(User $user): array
    {
        return $user->pomodoroSessions()
            ->whereNotNull('tag')
            ->distinct()
            ->orderBy('tag')
            ->pluck('tag')
            ->all();
    }
}
