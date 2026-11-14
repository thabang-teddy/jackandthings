<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Web\BodyMetricController;
use App\Http\Controllers\Web\BudgetAccountController;
use App\Http\Controllers\Web\BudgetController;
use App\Http\Controllers\Web\BudgetTransactionController;
use App\Http\Controllers\Web\BudgetTransferController;
use App\Http\Controllers\Web\ExerciseController;
use App\Http\Controllers\Web\HistoryEntryController;
use App\Http\Controllers\Web\HomeController;
use App\Http\Controllers\Web\NoteController;
use App\Http\Controllers\Web\PomodoroController;
use App\Http\Controllers\Web\PomodoroPresetController;
use App\Http\Controllers\Web\PomodoroSessionController;
use App\Http\Controllers\Web\ProgressPhotoController;
use App\Http\Controllers\Web\RecurringTransactionController;
use App\Http\Controllers\Web\WatchListController;
use App\Http\Controllers\Web\WatchListItemController;
use App\Http\Controllers\Web\WorkoutController;
use App\Http\Controllers\Web\WorkoutEntryController;
use App\Http\Controllers\Web\WorkoutPresetController;
use App\Http\Controllers\Web\WorkoutRoutineController;
use App\Http\Controllers\Web\WorkoutSessionController;
use App\Http\Controllers\Web\WorkoutSetController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', [HomeController::class, 'show'])->name('home');

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

/*
 * Module routes.
 *
 * Every record reached here belongs to the authenticated user: controllers scope
 * through $request->user()->relation(), and a record owned by anybody else
 * resolves to 404 rather than 403 (see AuthorizesOwnership) so existence is
 * never confirmed to a non-owner.
 */
Route::middleware(['auth', 'verified'])->group(function () {
    // Notes
    Route::resource('notes', NoteController::class)->except(['show']);

    // Pomodoro — the running timer is still client-side; presets are stored,
    // and so is each interval once it finishes, which is what the daily and
    // weekly analytics are read from.
    //
    // Four pages rather than one with anchors. The GET pages are declared
    // before the writes that share their path so "presets" and "sessions" are
    // never read as a record id.
    Route::get('pomodoro', [PomodoroController::class, 'index'])->name('pomodoro.index');
    Route::get('pomodoro/presets', [PomodoroController::class, 'presets'])->name('pomodoro.presets');
    Route::get('pomodoro/sessions', [PomodoroController::class, 'sessions'])->name('pomodoro.sessions');
    Route::get('pomodoro/stats', [PomodoroController::class, 'stats'])->name('pomodoro.stats');

    Route::post('pomodoro/presets', [PomodoroPresetController::class, 'store'])->name('pomodoro.presets.store');
    Route::put('pomodoro/presets/{preset}', [PomodoroPresetController::class, 'update'])->name('pomodoro.presets.update');
    Route::delete('pomodoro/presets/{preset}', [PomodoroPresetController::class, 'destroy'])->name('pomodoro.presets.destroy');
    Route::post('pomodoro/sessions', [PomodoroSessionController::class, 'store'])->name('pomodoro.sessions.store');
    Route::delete('pomodoro/sessions/{pomodoroSession}', [PomodoroSessionController::class, 'destroy'])
        ->name('pomodoro.sessions.destroy');

    // Watch list — a group of named lists, each holding items.
    Route::get('watchlist', [WatchListController::class, 'index'])->name('watchlist.index');
    Route::post('watchlist', [WatchListController::class, 'store'])->name('watchlist.store');
    Route::delete('watchlist/{watchList}', [WatchListController::class, 'destroy'])->name('watchlist.destroy');
    Route::post('watchlist/items', [WatchListItemController::class, 'store'])->name('watchlist.items.store');
    Route::put('watchlist/items/{watchListItem}', [WatchListItemController::class, 'update'])->name('watchlist.items.update');
    Route::delete('watchlist/items/{watchListItem}', [WatchListItemController::class, 'destroy'])->name('watchlist.items.destroy');

    /*
     * Workout — six pages since issue #4: Today, the exercise library, the
     * routine builder, the session history, body metrics and stats.
     *
     * Everything with a literal path segment is declared *before*
     * Route::resource('workouts'), whose {workout} parameter would otherwise
     * swallow "library", "routines" and the rest as entry ids. The one-line
     * entry log and its presets are untouched by issue #4.
     */
    Route::get('workouts', [WorkoutController::class, 'index'])->name('workouts.index');
    Route::get('workouts/library', [WorkoutController::class, 'library'])->name('workouts.library');
    Route::get('workouts/routines', [WorkoutController::class, 'routines'])->name('workouts.routines');
    Route::get('workouts/sessions', [WorkoutController::class, 'sessions'])->name('workouts.sessions');
    Route::get('workouts/body', [WorkoutController::class, 'body'])->name('workouts.body');
    Route::get('workouts/stats', [WorkoutController::class, 'stats'])->name('workouts.stats');

    Route::post('workouts/presets', [WorkoutPresetController::class, 'store'])->name('workouts.presets.store');
    Route::delete('workouts/presets/{workoutPreset}', [WorkoutPresetController::class, 'destroy'])->name('workouts.presets.destroy');

    // The user's own exercises. The seeded catalog is read-only to everybody.
    // "history" is declared before the {exercise} writes for the same reason
    // the page routes are declared before the workouts resource.
    Route::get('workouts/exercises/{exercise}/history', [ExerciseController::class, 'history'])
        ->name('workouts.exercises.history');
    Route::post('workouts/exercises', [ExerciseController::class, 'store'])->name('workouts.exercises.store');
    Route::put('workouts/exercises/{exercise}', [ExerciseController::class, 'update'])->name('workouts.exercises.update');
    Route::delete('workouts/exercises/{exercise}', [ExerciseController::class, 'destroy'])->name('workouts.exercises.destroy');

    Route::post('workouts/routines', [WorkoutRoutineController::class, 'store'])->name('workouts.routines.store');
    Route::put('workouts/routines/{routine}', [WorkoutRoutineController::class, 'update'])->name('workouts.routines.update');
    Route::delete('workouts/routines/{routine}', [WorkoutRoutineController::class, 'destroy'])->name('workouts.routines.destroy');

    Route::post('workouts/sessions', [WorkoutSessionController::class, 'store'])->name('workouts.sessions.store');
    Route::put('workouts/sessions/{session}', [WorkoutSessionController::class, 'update'])->name('workouts.sessions.update');
    Route::post('workouts/sessions/{session}/finish', [WorkoutSessionController::class, 'finish'])->name('workouts.sessions.finish');
    Route::delete('workouts/sessions/{session}', [WorkoutSessionController::class, 'destroy'])->name('workouts.sessions.destroy');

    Route::post('workouts/sessions/{session}/sets', [WorkoutSetController::class, 'store'])->name('workouts.sets.store');
    Route::put('workouts/sets/{set}', [WorkoutSetController::class, 'update'])->name('workouts.sets.update');
    Route::delete('workouts/sets/{set}', [WorkoutSetController::class, 'destroy'])->name('workouts.sets.destroy');

    Route::post('workouts/body', [BodyMetricController::class, 'store'])->name('workouts.body.store');
    Route::put('workouts/body/{metric}', [BodyMetricController::class, 'update'])->name('workouts.body.update');
    Route::delete('workouts/body/{metric}', [BodyMetricController::class, 'destroy'])->name('workouts.body.destroy');

    // The only route to a stored progress photo, and it authorizes first.
    Route::post('workouts/photos', [ProgressPhotoController::class, 'store'])->name('progress-photos.store');
    Route::get('workouts/photos/{photo}/file', [ProgressPhotoController::class, 'file'])->name('progress-photos.file');
    Route::delete('workouts/photos/{photo}', [ProgressPhotoController::class, 'destroy'])->name('progress-photos.destroy');

    // Polled by the open page for its hourly desktop nudge; declared before
    // the resource so "due" is not read as a {workout} id.
    Route::get('workouts/due', [WorkoutEntryController::class, 'due'])->name('workouts.due');
    // index lives on WorkoutController above, as the Today page.
    Route::resource('workouts', WorkoutEntryController::class)->except(['show', 'index']);

    // History — immutable entries: add and remove only, no edit.
    Route::get('history', [HistoryEntryController::class, 'index'])->name('history.index');
    Route::post('history', [HistoryEntryController::class, 'store'])->name('history.store');
    Route::delete('history/{history}', [HistoryEntryController::class, 'destroy'])->name('history.destroy');

    // Budget — Overview is the index; Cards, Transfer, Transactions and
    // Recurring are their own pages.
    Route::get('budget', [BudgetController::class, 'index'])->name('budget.index');
    Route::get('budget/cards', [BudgetController::class, 'cards'])->name('budget.cards');
    Route::get('budget/transfer', [BudgetController::class, 'transfer'])->name('budget.transfer');
    Route::get('budget/transactions', [BudgetController::class, 'transactions'])->name('budget.transactions');
    Route::get('budget/recurring', [BudgetController::class, 'recurring'])->name('budget.recurring');

    Route::post('budget/accounts', [BudgetAccountController::class, 'store'])->name('budget.accounts.store');
    Route::put('budget/accounts/{account}', [BudgetAccountController::class, 'update'])->name('budget.accounts.update');
    Route::delete('budget/accounts/{account}', [BudgetAccountController::class, 'destroy'])->name('budget.accounts.destroy');
    Route::post('budget/transactions', [BudgetTransactionController::class, 'store'])->name('budget.transactions.store');
    Route::delete('budget/transactions/{transaction}', [BudgetTransactionController::class, 'destroy'])->name('budget.transactions.destroy');
    Route::post('budget/transfers', [BudgetTransferController::class, 'store'])->name('budget.transfers.store');

    Route::post('budget/recurring', [RecurringTransactionController::class, 'store'])->name('budget.recurring.store');
    Route::put('budget/recurring/{recurring}', [RecurringTransactionController::class, 'update'])->name('budget.recurring.update');
    Route::delete('budget/recurring/{recurring}', [RecurringTransactionController::class, 'destroy'])->name('budget.recurring.destroy');
});

require __DIR__.'/auth.php';
