<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\PomodoroSessionRequest;
use App\Http\Resources\PomodoroSessionPayload;
use App\Models\PomodoroSession;
use App\Services\PomodoroAnalytics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Finished intervals for the Android app and the add-on, plus the `stats`
 * endpoint both use to draw their analytics without re-deriving the buckets.
 *
 * No update, for the same reason as the web controller: a recorded interval
 * is history.
 */
class PomodoroSessionController extends Controller
{
    use AuthorizesOwnership;

    /** Pages of this size keep a phone's first analytics load small. */
    private const PER_PAGE = 100;

    public function __construct(private readonly PomodoroAnalytics $analytics) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:'.self::PER_PAGE],
            'since' => ['sometimes', 'date'],
        ]);

        $query = $request->user()->pomodoroSessions()->latest('started_at');

        if ($request->filled('since')) {
            $query->where('started_at', '>=', $request->date('since'));
        }

        return response()->json([
            'data' => PomodoroSessionPayload::collection(
                $query->limit($request->integer('limit', self::PER_PAGE))->get()
            ),
        ]);
    }

    public function store(PomodoroSessionRequest $request): JsonResponse
    {
        $session = $request->user()->pomodoroSessions()->create($request->validated());

        return response()->json(['data' => PomodoroSessionPayload::from($session)], 201);
    }

    public function show(PomodoroSession $pomodoroSession): JsonResponse
    {
        $this->authorizeOwned('view', $pomodoroSession);

        return response()->json(['data' => PomodoroSessionPayload::from($pomodoroSession)]);
    }

    public function destroy(PomodoroSession $pomodoroSession): JsonResponse
    {
        $this->authorizeOwned('delete', $pomodoroSession);

        $pomodoroSession->delete();

        return response()->json(status: 204);
    }

    /**
     * Daily and weekly totals, already bucketed in the client's own timezone -
     * see PomodoroAnalytics for why the client has to say which that is.
     */
    public function stats(Request $request): JsonResponse
    {
        $request->validate(['tz' => PomodoroAnalytics::REQUEST_TIMEZONE_RULE]);

        return response()->json([
            'data' => $this->analytics->for($request->user(), $request->string('tz')->toString()),
        ]);
    }
}
