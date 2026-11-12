<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Note;
use App\Models\WorkoutPreset;
use App\Services\WorkoutReminderStatus;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __construct(private readonly WorkoutReminderStatus $reminderStatus) {}

    public function show(Request $request): Response
    {
        $user = $request->user();

        if ($user === null) {
            return Inertia::render('Welcome', [
                'canLogin' => Route::has('login'),
            ]);
        }

        // Starred notes only: the home page is a pinboard the user chooses,
        // not the tail of the notes list. The cap stays so a user who stars
        // everything does not get an unbounded home page.
        $notes = $user->notes()
            ->where('is_starred', true)
            ->latest()
            ->take(4)
            ->get()
            ->map(fn (Note $note): array => [
                'id' => $note->id,
                'title' => $note->title,
                'body' => $note->body,
                'is_starred' => $note->is_starred,
            ]);

        $defaultPreset = $user->pomodoroPresets()
            ->where('is_default', true)
            ->first();

        $presets = $user->workoutPresets()
            ->oldest()
            ->get()
            ->map(fn (WorkoutPreset $preset): array => [
                'id' => $preset->id,
                'name' => $preset->name,
                'activity' => $preset->activity,
            ]);

        return Inertia::render('Welcome', [
            'notes' => $notes,
            'presets' => $presets,
            'dueForReminder' => $this->reminderStatus->isDue($user),
            'lastLoggedAt' => $this->reminderStatus->lastLoggedAt($user)?->toIso8601String(),
            'defaultPreset' => $defaultPreset === null ? null : [
                'id' => $defaultPreset->id,
                'name' => $defaultPreset->name,
                'focus_minutes' => $defaultPreset->focus_minutes,
                'break_minutes' => $defaultPreset->break_minutes,
            ],
        ]);
    }
}
