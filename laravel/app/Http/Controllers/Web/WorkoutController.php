<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Enums\ExerciseCategory;
use App\Enums\ExerciseMetric;
use App\Http\Controllers\Controller;
use App\Http\Resources\BodyMetricPayload;
use App\Http\Resources\ExercisePayload;
use App\Http\Resources\ProgressPhotoPayload;
use App\Http\Resources\WorkoutRoutinePayload;
use App\Http\Resources\WorkoutSessionPayload;
use App\Models\BodyMetric;
use App\Models\Exercise;
use App\Models\User;
use App\Models\WorkoutEntry;
use App\Models\WorkoutPreset;
use App\Models\WorkoutSession;
use App\Services\ProgressPhotoStorage;
use App\Services\WorkoutAnalytics;
use App\Services\WorkoutRecords;
use App\Services\WorkoutReminderStatus;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Workout module's six pages: Today, the exercise library, the routine
 * builder, the session history, body metrics and stats.
 *
 * It was one page with three anchors until issue #4, which is the same story
 * Pomodoro had with issue #3: a module that grew an exercise library, a
 * routine builder and a 90-day calendar does not fit under one scroll bar,
 * and scrolling past all of it to log a set is not a workout tracker.
 *
 * Each action below loads only what its own page draws, so opening the library
 * runs no analytics query and opening Today reads neither the calendar nor the
 * records. The rest timer and the live session are client-side and shared
 * across the pages by WorkoutSessionProvider, so moving between them never
 * disturbs a workout in progress.
 */
class WorkoutController extends Controller
{
    /** Sessions listed on the Sessions page before paging would be wanted. */
    private const RECENT_SESSIONS = 30;

    /** Readings listed on the Body page. */
    private const RECENT_METRICS = 120;

    public function __construct(
        private readonly WorkoutReminderStatus $reminderStatus,
        private readonly WorkoutAnalytics $analytics,
        private readonly WorkoutRecords $records,
    ) {}

    /**
     * Today: the reminder banner, the quick one-line log, the routines you can
     * start, and the workout in progress if there is one.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Workout/Index', [
            'entries' => $this->recentEntries($user),
            'presets' => $this->presetsFor($user),
            'routines' => WorkoutRoutinePayload::collection(
                $user->workoutRoutines()->with('items.exercise')->oldest()->get()
            ),
            'openSession' => $this->openSessionFor($user),
            // The set logger needs every exercise the user may pick, and a
            // live workout is not always one that follows a routine.
            'exercises' => ExercisePayload::collection(
                Exercise::query()->visibleTo($user)->orderBy('name')->get()
            ),
            // Rendered as an in-page banner, and polled separately by
            // resources/js/Lib/useWorkoutNudge.js for the desktop alert.
            'dueForReminder' => $this->reminderStatus->isDue($user),
            'lastLoggedAt' => $this->reminderStatus->lastLoggedAt($user)?->toIso8601String(),
        ]);
    }

    /** The exercise library: the seeded catalog plus the user's own. */
    public function library(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Workout/Library', [
            'exercises' => ExercisePayload::collection(
                Exercise::query()->visibleTo($user)->orderBy('name')->get()
            ),
            'categories' => $this->categoryOptions(),
            'metrics' => $this->metricOptions(),
        ]);
    }

    /** The routine builder. */
    public function routines(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Workout/Routines', [
            'routines' => WorkoutRoutinePayload::collection(
                $user->workoutRoutines()->with('items.exercise')->oldest()->get()
            ),
            // The picker needs every exercise the user may choose from.
            'exercises' => ExercisePayload::collection(
                Exercise::query()->visibleTo($user)->orderBy('name')->get()
            ),
        ]);
    }

    /** Logged workouts, newest first, with their sets. */
    public function sessions(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Workout/Sessions', [
            'sessions' => WorkoutSessionPayload::collection(
                $user->workoutSessions()
                    ->with('sets.exercise')
                    ->latest('started_at')
                    ->limit(self::RECENT_SESSIONS)
                    ->get()
            ),
            'entries' => $this->recentEntries($user),
        ]);
    }

    /** Body weight, body fat, tape measurements and progress photos. */
    public function body(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Workout/Body', [
            'metrics' => BodyMetricPayload::collection(
                $user->bodyMetrics()
                    ->with('photos')
                    ->orderByDesc('measured_on')
                    ->limit(self::RECENT_METRICS)
                    ->get()
            ),
            'photos' => ProgressPhotoPayload::collection(
                $user->progressPhotos()->orderByDesc('taken_on')->get()
            ),
            'sites' => BodyMetric::SITES,
            'maxPhotoKilobytes' => ProgressPhotoStorage::MAX_KILOBYTES,
        ]);
    }

    /** Volume, streaks, the calendar and the personal records. */
    public function stats(Request $request): Response
    {
        $user = $request->user();

        $validated = $request->validate(['tz' => WorkoutAnalytics::REQUEST_TIMEZONE_RULE]);

        return Inertia::render('Workout/Stats', [
            'analytics' => $this->analytics->for($user, $validated['tz'] ?? null),
            'records' => $this->records->all($user),
        ]);
    }

    /**
     * The workout in progress, or null. A client needs this on load so a
     * session started on the phone can be continued in the browser.
     *
     * @return array<string, mixed>|null
     */
    private function openSessionFor(User $user): ?array
    {
        /** @var WorkoutSession|null $session */
        $session = $user->workoutSessions()
            ->open()
            ->with('sets.exercise')
            ->latest('started_at')
            ->first();

        return $session === null ? null : WorkoutSessionPayload::from($session);
    }

    /**
     * The one-line entry log, which issue #4 leaves exactly as it was: it is
     * the quick "I did a thing" path and the home page's popup still uses it.
     */
    private function recentEntries(User $user): LengthAwarePaginator
    {
        return $user->workoutEntries()
            ->latest('logged_at')
            ->paginate(15)
            ->through(fn (WorkoutEntry $entry): array => [
                'id' => $entry->id,
                'activity' => $entry->activity,
                'notes' => $entry->notes,
                'logged_at' => $entry->logged_at?->toIso8601String(),
            ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function presetsFor(User $user): Collection
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

    /**
     * @return array<int, array<string, string>>
     */
    private function categoryOptions(): array
    {
        return array_map(
            fn (ExerciseCategory $category): array => [
                'value' => $category->value,
                'label' => $category->label(),
            ],
            ExerciseCategory::cases()
        );
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function metricOptions(): array
    {
        return array_map(
            fn (ExerciseMetric $metric): array => [
                'value' => $metric->value,
                'label' => $metric->label(),
            ],
            ExerciseMetric::cases()
        );
    }
}
