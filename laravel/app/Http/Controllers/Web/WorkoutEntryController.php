<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkoutEntryRequest;
use App\Models\WorkoutEntry;
use App\Services\WorkoutReminderStatus;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
                'logged_at' => $entry->logged_at?->toDayDateTimeString(),
            ]);

        return Inertia::render('Workout/Index', [
            'entries' => $entries,
            // Rendered as an in-page banner. Nothing is sent anywhere: see
            // WorkoutReminderStatus for why delivery is not built yet.
            'dueForReminder' => $this->reminderStatus->isDue($user),
            'lastLoggedAt' => $this->reminderStatus->lastLoggedAt($user)?->toDayDateTimeString(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Workout/Form', ['entry' => null]);
    }

    public function store(WorkoutEntryRequest $request): RedirectResponse
    {
        $request->user()->workoutEntries()->create($request->validatedWithDefaults());

        return to_route('workouts.index')->with('status', 'Workout logged.');
    }

    public function edit(WorkoutEntry $workout): Response
    {
        $this->authorizeOwned('view', $workout);

        return Inertia::render('Workout/Form', [
            'entry' => [
                'id' => $workout->id,
                'activity' => $workout->activity,
                'notes' => $workout->notes,
                'logged_at' => $workout->logged_at?->format('Y-m-d\TH:i'),
            ],
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
}
