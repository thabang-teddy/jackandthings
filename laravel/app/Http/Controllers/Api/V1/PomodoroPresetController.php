<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\PomodoroPresetRequest;
use App\Models\PomodoroPreset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PomodoroPresetController extends Controller
{
    use AuthorizesOwnership;

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->pomodoroPresets()->oldest()->get(),
        ]);
    }

    public function store(PomodoroPresetRequest $request): JsonResponse
    {
        $preset = $request->user()->pomodoroPresets()->create($request->validated());

        return response()->json(['data' => $preset], 201);
    }

    public function show(PomodoroPreset $preset): JsonResponse
    {
        $this->authorizeOwned('view', $preset);

        return response()->json(['data' => $preset]);
    }

    public function update(PomodoroPresetRequest $request, PomodoroPreset $preset): JsonResponse
    {
        $this->authorizeOwned('update', $preset);

        $preset->update($request->validated());

        return response()->json(['data' => $preset]);
    }

    public function destroy(PomodoroPreset $preset): JsonResponse
    {
        $this->authorizeOwned('delete', $preset);

        $preset->delete();

        return response()->json(status: 204);
    }
}
