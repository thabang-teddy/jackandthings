<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PomodoroLiveLinkPayload;
use App\Models\PomodoroLiveLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The live link: the Pomodoro state that is running right now, stored so the
 * website and the phone can see each other's timer and stay in sync.
 *
 * One row per user, replaced each time the timer changes and deleted when it
 * stops. There is no route binding: the row is always the caller's own, reached
 * through the authenticated user's relation, which is what keeps a client from
 * touching another user's live link.
 */
class PomodoroLiveLinkController extends Controller
{
    /** The running timer, or null when nothing is active. */
    public function show(Request $request): JsonResponse
    {
        $liveLink = $request->user()->pomodoroLiveLink;

        return response()->json([
            'data' => $liveLink === null ? null : PomodoroLiveLinkPayload::from($liveLink),
        ]);
    }

    /** Create or replace the live link with the timer state the client is running. */
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

    /** Stop the timer: delete the live link so no other client keeps showing it. */
    public function destroy(Request $request): JsonResponse
    {
        $request->user()->pomodoroLiveLink()?->delete();

        return response()->json(status: 204);
    }
}
