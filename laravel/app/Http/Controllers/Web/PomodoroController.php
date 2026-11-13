<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Resources\PomodoroPresetPayload;
use App\Http\Resources\PomodoroSessionPayload;
use App\Services\PomodoroAnalytics;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PomodoroController extends Controller
{
    public function __construct(private readonly PomodoroAnalytics $analytics) {}

    /**
     * The countdown itself still runs client-side. What is persisted is the
     * presets and, since issue #3, the intervals that have finished - the
     * analytics below are read off those. A *running* timer is still never
     * stored; see the create_pomodoro_sessions_table migration.
     *
     * `tz` comes from the page (`Intl.DateTimeFormat().resolvedOptions()`)
     * because the server runs in UTC and would otherwise bucket an evening
     * session onto the wrong day.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        $request->validate(['tz' => PomodoroAnalytics::REQUEST_TIMEZONE_RULE]);

        return Inertia::render('Pomodoro/Index', [
            'presets' => PomodoroPresetPayload::collection($user->pomodoroPresets()->oldest()->get()),
            'analytics' => $this->analytics->for($user, $request->string('tz')->toString()),
            'recentSessions' => PomodoroSessionPayload::collection(
                $user->pomodoroSessions()->latest('started_at')->limit(20)->get()
            ),
            // Tags already used, so the preset form can offer them rather than
            // making the user retype "Studying" and spell it differently.
            'tags' => $user->pomodoroSessions()
                ->whereNotNull('tag')
                ->distinct()
                ->orderBy('tag')
                ->pluck('tag')
                ->all(),
        ]);
    }
}
