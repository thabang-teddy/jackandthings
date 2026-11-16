<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Resources\PomodoroLiveLinkPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The live link for the session-guarded web app: the Pomodoro state that is
 * running right now, stored so the website and the phone can see each other's
 * timer and stay in sync.
 *
 * Mirrors the api.v1 controller, but behind the session guard so the React
 * home page can post its running timer and read the phone's without a token.
 */
class PomodoroLiveLinkController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $liveLink = $request->user()->pomodoroLiveLink;

        return response()->json([
            'data' => $liveLink === null ? null : PomodoroLiveLinkPayload::from($liveLink),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'state' => ['required', 'array'],
        ]);

        $liveLink = $request->user()->pomodoroLiveLink()
            ->updateOrCreate(
                [],
                ['state' => $request->validated()['state']],
            );

        return response()->json([
            'data' => PomodoroLiveLinkPayload::from($liveLink),
        ], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->user()->pomodoroLiveLink()?->delete();

        return response()->json(status: 204);
    }
}
