<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BodyMetricController;
use App\Http\Controllers\Api\V1\BudgetAccountController;
use App\Http\Controllers\Api\V1\BudgetTransactionController;
use App\Http\Controllers\Api\V1\BudgetTransferController;
use App\Http\Controllers\Api\V1\ExerciseController;
use App\Http\Controllers\Api\V1\HistoryEntryController;
use App\Http\Controllers\Api\V1\NoteController;
use App\Http\Controllers\Api\V1\PomodoroPresetController;
use App\Http\Controllers\Api\V1\PomodoroSessionController;
use App\Http\Controllers\Api\V1\ProgressPhotoController;
use App\Http\Controllers\Api\V1\RecurringTransactionController;
use App\Http\Controllers\Api\V1\WatchListController;
use App\Http\Controllers\Api\V1\WatchListItemController;
use App\Http\Controllers\Api\V1\WorkoutEntryController;
use App\Http\Controllers\Api\V1\WorkoutPresetController;
use App\Http\Controllers\Api\V1\WorkoutRoutineController;
use App\Http\Controllers\Api\V1\WorkoutSessionController;
use App\Http\Controllers\Api\V1\WorkoutSetController;
use App\Http\Controllers\Api\V1\WorkoutStatsController;
use Illuminate\Support\Facades\Route;

/*
 * Versioned token API for the non-browser clients described in docs/PRD.md: the
 * Kotlin Android app and the Chrome/Firefox add-ons. The web app itself uses the
 * session guard in routes/web.php, not these endpoints.
 *
 * Every route below is scoped to the authenticated token's user; a record owned
 * by anybody else resolves to 404, never 403.
 */
Route::prefix('v1')->name('api.v1.')->group(function () {
    // Throttled harder than the rest: this is the password-guessing surface.
    Route::post('auth/token', [AuthController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('auth.token');

    Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
        Route::get('auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::delete('auth/token', [AuthController::class, 'destroy'])->name('auth.token.destroy');

        Route::apiResource('notes', NoteController::class);
        Route::apiResource('pomodoro-presets', PomodoroPresetController::class)->parameters(['pomodoro-presets' => 'preset']);

        // Declared before the resource so "stats" is not read as a session id.
        Route::get('pomodoro-sessions/stats', [PomodoroSessionController::class, 'stats'])
            ->name('pomodoro-sessions.stats');
        Route::apiResource('pomodoro-sessions', PomodoroSessionController::class)
            ->except(['update']);

        Route::apiResource('watch-lists', WatchListController::class)->parameters(['watch-lists' => 'watchList']);
        Route::apiResource('watch-list-items', WatchListItemController::class)
            ->parameters(['watch-list-items' => 'watchListItem'])
            ->only(['index', 'store', 'update', 'destroy']);

        // Reminder state a client polls; the server sends no notifications.
        Route::get('workout-entries/due', [WorkoutEntryController::class, 'due'])->name('workout-entries.due');
        Route::apiResource('workout-entries', WorkoutEntryController::class)->parameters(['workout-entries' => 'workout']);
        Route::apiResource('workout-presets', WorkoutPresetController::class)
            ->parameters(['workout-presets' => 'workoutPreset'])
            ->only(['index', 'store', 'destroy']);

        /*
         * Fitness tracking (issue #4). The exercise library is the catalog plus
         * the caller's own rows; everything else below is theirs alone.
         */

        // Declared before the resource so "history" is not read as an id.
        Route::get('exercises/{exercise}/history', [ExerciseController::class, 'history'])
            ->name('exercises.history');
        Route::apiResource('exercises', ExerciseController::class);

        Route::apiResource('workout-routines', WorkoutRoutineController::class)
            ->parameters(['workout-routines' => 'routine']);

        // "current" before the resource, so it is not read as a session id.
        Route::get('workout-sessions/current', [WorkoutSessionController::class, 'current'])
            ->name('workout-sessions.current');
        Route::post('workout-sessions/{session}/finish', [WorkoutSessionController::class, 'finish'])
            ->name('workout-sessions.finish');
        Route::apiResource('workout-sessions', WorkoutSessionController::class)
            ->parameters(['workout-sessions' => 'session']);

        // Sets are nested under the session they belong to on write, and
        // addressed directly on update and delete.
        Route::get('workout-sessions/{session}/sets', [WorkoutSetController::class, 'index'])
            ->name('workout-sessions.sets.index');
        Route::post('workout-sessions/{session}/sets', [WorkoutSetController::class, 'store'])
            ->name('workout-sessions.sets.store');
        Route::put('workout-sets/{set}', [WorkoutSetController::class, 'update'])
            ->name('workout-sets.update');
        Route::delete('workout-sets/{set}', [WorkoutSetController::class, 'destroy'])
            ->name('workout-sets.destroy');

        Route::apiResource('body-metrics', BodyMetricController::class)
            ->parameters(['body-metrics' => 'metric']);

        // The only route to a stored image, and it authorizes first.
        Route::get('progress-photos/{photo}/file', [ProgressPhotoController::class, 'file'])
            ->name('progress-photos.file');
        Route::apiResource('progress-photos', ProgressPhotoController::class)
            ->parameters(['progress-photos' => 'photo'])
            ->only(['index', 'store', 'destroy']);

        Route::get('workout-stats', WorkoutStatsController::class)->name('workout-stats');

        Route::apiResource('history-entries', HistoryEntryController::class)
            ->parameters(['history-entries' => 'history'])
            ->except(['update']);

        Route::apiResource('budget-accounts', BudgetAccountController::class)->parameters(['budget-accounts' => 'account']);
        Route::apiResource('budget-transactions', BudgetTransactionController::class)
            ->parameters(['budget-transactions' => 'transaction'])
            ->only(['index', 'store', 'destroy']);
        Route::post('budget-transfers', [BudgetTransferController::class, 'store'])->name('budget-transfers.store');
        Route::apiResource('recurring-transactions', RecurringTransactionController::class)->parameters(['recurring-transactions' => 'recurring']);
    });
});
