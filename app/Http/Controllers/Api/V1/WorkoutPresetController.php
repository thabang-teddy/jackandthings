<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutPresetRequest;
use App\Models\WorkoutPreset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkoutPresetController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->workoutPresets()->oldest()->get(),
        ]);
    }

    public function store(WorkoutPresetRequest $request): JsonResponse
    {
        $preset = $request->user()->workoutPresets()->create($request->validated());

        return response()->json(['data' => $preset], 201);
    }

    public function destroy(WorkoutPreset $workoutPreset): JsonResponse
    {
        $this->authorizeOwned('delete', $workoutPreset);

        $workoutPreset->delete();

        return response()->json(status: 204);
    }
}
