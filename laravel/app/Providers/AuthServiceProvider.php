<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\BudgetAccount;
use App\Models\BudgetTransaction;
use App\Models\ClipboardItem;
use App\Models\HistoryEntry;
use App\Models\Note;
use App\Models\PomodoroPreset;
use App\Models\RecurringTransaction;
use App\Models\WorkoutEntry;
use App\Models\WorkoutPreset;
use App\Policies\BudgetAccountPolicy;
use App\Policies\BudgetTransactionPolicy;
use App\Policies\ClipboardItemPolicy;
use App\Policies\HistoryEntryPolicy;
use App\Policies\NotePolicy;
use App\Policies\PomodoroPresetPolicy;
use App\Policies\RecurringTransactionPolicy;
use App\Policies\WorkoutEntryPolicy;
use App\Policies\WorkoutPresetPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Policies are registered explicitly rather than relying on naming-convention
 * discovery, so a model can never silently end up with no policy guarding it.
 *
 * There is deliberately no Gate::before() bypass: no role can skip an ownership
 * check, because every record in this application belongs to exactly one user.
 */
class AuthServiceProvider extends ServiceProvider
{
    private const POLICIES = [
        PomodoroPreset::class => PomodoroPresetPolicy::class,
        Note::class => NotePolicy::class,
        BudgetAccount::class => BudgetAccountPolicy::class,
        BudgetTransaction::class => BudgetTransactionPolicy::class,
        RecurringTransaction::class => RecurringTransactionPolicy::class,
        WorkoutEntry::class => WorkoutEntryPolicy::class,
        WorkoutPreset::class => WorkoutPresetPolicy::class,
        ClipboardItem::class => ClipboardItemPolicy::class,
        HistoryEntry::class => HistoryEntryPolicy::class,
    ];

    public function boot(): void
    {
        foreach (self::POLICIES as $model => $policy) {
            Gate::policy($model, $policy);
        }
    }
}
