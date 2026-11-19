<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\WorkoutAnalytics;
use App\Services\WorkoutRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Volume, streaks, the calendar and the personal records - everything the
 * stats page and the Android stats screen draw.
 *
 * The timezone comes from the client because bucketing in UTC would put an
 * evening workout on the wrong day for anybody not living there. Validation
 * is PomodoroAnalytics's rule, shared so the two endpoints cannot disagree
 * about what a valid zone is.
 */
class WorkoutStatsController extends Controller
{
    public function __construct(
        private readonly WorkoutAnalytics $analytics,
        private readonly WorkoutRecords $records,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tz' => WorkoutAnalytics::REQUEST_TIMEZONE_RULE,
        ]);

        $user = $request->user();

        return response()->json([
            'data' => [
                ...$this->analytics->for($user, $validated['tz'] ?? null),
                'records' => $this->records->all($user),
            ],
        ]);
    }
}
