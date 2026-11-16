<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutReminderSettingRequest;
use App\Models\WorkoutReminderSetting;
use App\Services\WorkoutReminderStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The user's workout reminder target: how many of an activity to hit, at
 * which times inside a daily window. One row per user.
 */
class WorkoutReminderSettingController extends Controller
{
    public function __construct(private readonly WorkoutReminderStatus $reminderStatus) {}

    /** The current setting plus progress toward the target. */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $setting = $user->workoutReminderSetting;

        return response()->json([
            'data' => $setting === null
                ? null
                : [
                    'id' => $setting->id,
                    'target_count' => $setting->target_count,
                    'activity' => $setting->activity,
                    'start_time' => $setting->start_time?->format('H:i'),
                    'end_time' => $setting->end_time?->format('H:i'),
                    'check_times' => $setting->check_times,
                    'active' => $setting->active,
                    'progress' => $this->reminderStatus->progress($user),
                ],
        ]);
    }

    /** Create or replace the reminder target. */
    public function store(WorkoutReminderSettingRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $checkTimes = $validated['check_times'];
        sort($checkTimes);
        $checkTimes = array_unique($checkTimes);

        $existing = $request->user()->workoutReminderSetting;
        if ($existing) {
            $existing->update([
                'target_count' => $validated['target_count'],
                'activity' => $validated['activity'] ?? null,
                'start_time' => $validated['start_time'],
                'end_time' => $validated['end_time'],
                'check_times' => $checkTimes,
                'active' => $validated['active'] ?? true,
            ]);
            $setting = $existing;
        } else {
            $setting = $request->user()->workoutReminderSetting()->create([
                'target_count' => $validated['target_count'],
                'activity' => $validated['activity'] ?? null,
                'start_time' => $validated['start_time'],
                'end_time' => $validated['end_time'],
                'check_times' => $checkTimes,
                'active' => $validated['active'] ?? true,
            ]);
        }

        return response()->json([
            'data' => [
                'id' => $setting->id,
                'target_count' => $setting->target_count,
                'activity' => $setting->activity,
                'start_time' => $setting->start_time?->format('H:i'),
                'end_time' => $setting->end_time?->format('H:i'),
                'check_times' => $setting->check_times,
                'active' => $setting->active,
                'progress' => $this->reminderStatus->progress($request->user()),
            ],
        ], 201);
    }

    /** Delete the reminder target. */
    public function destroy(Request $request): JsonResponse
    {
        $request->user()->workoutReminderSetting()?->delete();

        return response()->json(status: 204);
    }
}
