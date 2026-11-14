<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Resources\PomodoroPresetPayload;
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
            // The whole preset, not just its minutes: the home page starts a
            // real session on the shared timer, so it needs the long break,
            // the auto-start toggles, the tag and the sounds too. Hand-listing
            // four of fourteen fields here is how the surfaces drift apart.
            'defaultPreset' => $defaultPreset === null
                ? null
                : PomodoroPresetPayload::from($defaultPreset),
        ]);
    }
}
