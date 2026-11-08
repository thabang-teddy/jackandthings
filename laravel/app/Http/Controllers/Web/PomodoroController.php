<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\PomodoroPreset;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PomodoroController extends Controller
{
    /**
     * The countdown itself runs client-side; only presets are persisted.
     */
    public function index(Request $request): Response
    {
        $presets = $request->user()->pomodoroPresets()
            ->oldest()
            ->get()
            ->map(fn (PomodoroPreset $preset): array => [
                'id' => $preset->id,
                'name' => $preset->name,
                'focus_minutes' => $preset->focus_minutes,
                'break_minutes' => $preset->break_minutes,
                'is_default' => $preset->is_default,
            ]);

        return Inertia::render('Pomodoro/Index', ['presets' => $presets]);
    }
}
