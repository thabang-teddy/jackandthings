<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BudgetAccountController;
use App\Http\Controllers\Api\V1\BudgetTransactionController;
use App\Http\Controllers\Api\V1\BudgetTransferController;
use App\Http\Controllers\Api\V1\ClipboardItemController;
use App\Http\Controllers\Api\V1\HistoryEntryController;
use App\Http\Controllers\Api\V1\NoteController;
use App\Http\Controllers\Api\V1\PomodoroPresetController;
use App\Http\Controllers\Api\V1\WorkoutEntryController;
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
        Route::apiResource('clipboard-items', ClipboardItemController::class)->parameters(['clipboard-items' => 'item']);

        // Reminder state a client polls; the server sends no notifications.
        Route::get('workout-entries/due', [WorkoutEntryController::class, 'due'])->name('workout-entries.due');
        Route::apiResource('workout-entries', WorkoutEntryController::class)->parameters(['workout-entries' => 'workout']);

        Route::apiResource('history-entries', HistoryEntryController::class)
            ->parameters(['history-entries' => 'history'])
            ->except(['update']);

        Route::apiResource('budget-accounts', BudgetAccountController::class)->parameters(['budget-accounts' => 'account']);
        Route::apiResource('budget-transactions', BudgetTransactionController::class)
            ->parameters(['budget-transactions' => 'transaction'])
            ->only(['index', 'store', 'destroy']);
        Route::post('budget-transfers', [BudgetTransferController::class, 'store'])->name('budget-transfers.store');
    });
});
