<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutEntryRequest;
use App\Models\User;
use App\Models\WorkoutEntry;
use App\Models\WorkoutPreset;
use App\Services\WorkoutReminderStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class WorkoutEntryController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly WorkoutReminderStatus $reminderStatus) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        $entries = $user->workoutEntries()
            ->latest('logged_at')
            ->paginate(15)
            ->through(fn (WorkoutEntry $entry): array => [
                'id' => $entry->id,
                'activity' => $entry->activity,
                'notes' => $entry->notes,
                'logged_at' => $entry->logged_at?->toIso8601String(),
            ]);

        return Inertia::render('Workout/Index', [
            'entries' => $entries,
            'presets' => $this->presetsFor($user),
            // Rendered as an in-page banner, and polled separately by
            // resources/js/Lib/useWorkoutNudge.js for the desktop alert.
            'dueForReminder' => $this->reminderStatus->isDue($user),
            'lastLoggedAt' => $this->reminderStatus->lastLoggedAt($user)?->toIso8601String(),
        ]);
    }

    /**
     * Reminder state for the open page to act on, mirroring api.v1
     * workout-entries.due for the session guard. The server still sends
     * nothing itself; the page decides whether to raise a notification.
     */
    public function due(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'due' => $this->reminderStatus->isDue($user),
            'last_logged_at' => $this->reminderStatus->lastLoggedAt($user)?->toIso8601String(),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Workout/Form', [
            'entry' => null,
            'presets' => $this->presetsFor($request->user()),
        ]);
    }

    public function store(WorkoutEntryRequest $request): RedirectResponse
    {
        $request->user()->workoutEntries()->create($request->validatedWithDefaults());

        // The home page's quick log popup saves without leaving the page;
        // every other create form still lands on the workout list.
        if ($request->input('return_to') === 'home') {
            return to_route('home')->with('status', 'Workout logged.');
        }

        return to_route('workouts.index')->with('status', 'Workout logged.');
    }

    public function edit(Request $request, WorkoutEntry $workout): Response
    {
        $this->authorizeOwned('view', $workout);

        return Inertia::render('Workout/Form', [
            'entry' => [
                'id' => $workout->id,
                'activity' => $workout->activity,
                'notes' => $workout->notes,
                'logged_at' => $workout->logged_at?->toIso8601String(),
            ],
            'presets' => $this->presetsFor($request->user()),
        ]);
    }

    public function update(WorkoutEntryRequest $request, WorkoutEntry $workout): RedirectResponse
    {
        $this->authorizeOwned('update', $workout);

        $workout->update($request->validatedWithDefaults());

        return to_route('workouts.index')->with('status', 'Workout updated.');
    }

    public function destroy(WorkoutEntry $workout): RedirectResponse
    {
        $this->authorizeOwned('delete', $workout);

        $workout->delete();

        return to_route('workouts.index')->with('status', 'Workout deleted.');
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function presetsFor(User $user)
    {
        return $user->workoutPresets()
            ->oldest()
            ->get()
            ->map(fn (WorkoutPreset $preset): array => [
                'id' => $preset->id,
                'name' => $preset->name,
                'activity' => $preset->activity,
            ]);
    }
}
