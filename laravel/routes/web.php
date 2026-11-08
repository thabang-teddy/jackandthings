<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Web\BudgetAccountController;
use App\Http\Controllers\Web\BudgetController;
use App\Http\Controllers\Web\BudgetTransactionController;
use App\Http\Controllers\Web\BudgetTransferController;
use App\Http\Controllers\Web\HistoryEntryController;
use App\Http\Controllers\Web\HomeController;
use App\Http\Controllers\Web\NoteController;
use App\Http\Controllers\Web\PomodoroController;
use App\Http\Controllers\Web\PomodoroPresetController;
use App\Http\Controllers\Web\RecurringTransactionController;
use App\Http\Controllers\Web\WatchListController;
use App\Http\Controllers\Web\WatchListItemController;
use App\Http\Controllers\Web\WorkoutEntryController;
use App\Http\Controllers\Web\WorkoutPresetController;
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

    // Pomodoro — the timer runs client-side; only presets are stored.
    Route::get('pomodoro', [PomodoroController::class, 'index'])->name('pomodoro.index');
    Route::post('pomodoro/presets', [PomodoroPresetController::class, 'store'])->name('pomodoro.presets.store');
    Route::put('pomodoro/presets/{preset}', [PomodoroPresetController::class, 'update'])->name('pomodoro.presets.update');
    Route::delete('pomodoro/presets/{preset}', [PomodoroPresetController::class, 'destroy'])->name('pomodoro.presets.destroy');

    // Watch list — a group of named lists, each holding items.
    Route::get('watchlist', [WatchListController::class, 'index'])->name('watchlist.index');
    Route::post('watchlist', [WatchListController::class, 'store'])->name('watchlist.store');
    Route::delete('watchlist/{watchList}', [WatchListController::class, 'destroy'])->name('watchlist.destroy');
    Route::post('watchlist/items', [WatchListItemController::class, 'store'])->name('watchlist.items.store');
    Route::put('watchlist/items/{watchListItem}', [WatchListItemController::class, 'update'])->name('watchlist.items.update');
    Route::delete('watchlist/items/{watchListItem}', [WatchListItemController::class, 'destroy'])->name('watchlist.items.destroy');

    // Workout
    Route::post('workouts/presets', [WorkoutPresetController::class, 'store'])->name('workouts.presets.store');
    Route::delete('workouts/presets/{workoutPreset}', [WorkoutPresetController::class, 'destroy'])->name('workouts.presets.destroy');
    Route::resource('workouts', WorkoutEntryController::class)->except(['show']);

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
