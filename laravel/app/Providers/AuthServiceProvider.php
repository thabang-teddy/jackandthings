<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\BodyMetric;
use App\Models\BudgetAccount;
use App\Models\BudgetCategory;
use App\Models\BudgetGoal;
use App\Models\BudgetLimit;
use App\Models\BudgetReceipt;
use App\Models\BudgetTransaction;
use App\Models\Exercise;
use App\Models\HistoryEntry;
use App\Models\Note;
use App\Models\PomodoroPreset;
use App\Models\PomodoroSession;
use App\Models\ProgressPhoto;
use App\Models\RecurringTransaction;
use App\Models\WatchList;
use App\Models\WatchListItem;
use App\Models\WorkoutEntry;
use App\Models\WorkoutPreset;
use App\Models\WorkoutRoutine;
use App\Models\WorkoutSession;
use App\Models\WorkoutSet;
use App\Policies\BodyMetricPolicy;
use App\Policies\BudgetAccountPolicy;
use App\Policies\BudgetCategoryPolicy;
use App\Policies\BudgetGoalPolicy;
use App\Policies\BudgetLimitPolicy;
use App\Policies\BudgetReceiptPolicy;
use App\Policies\BudgetTransactionPolicy;
use App\Policies\ExercisePolicy;
use App\Policies\HistoryEntryPolicy;
use App\Policies\NotePolicy;
use App\Policies\PomodoroPresetPolicy;
use App\Policies\PomodoroSessionPolicy;
use App\Policies\ProgressPhotoPolicy;
use App\Policies\RecurringTransactionPolicy;
use App\Policies\WatchListItemPolicy;
use App\Policies\WatchListPolicy;
use App\Policies\WorkoutEntryPolicy;
use App\Policies\WorkoutPresetPolicy;
use App\Policies\WorkoutRoutinePolicy;
use App\Policies\WorkoutSessionPolicy;
use App\Policies\WorkoutSetPolicy;
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
        PomodoroSession::class => PomodoroSessionPolicy::class,
        Note::class => NotePolicy::class,
        BudgetAccount::class => BudgetAccountPolicy::class,
        BudgetCategory::class => BudgetCategoryPolicy::class,
        BudgetLimit::class => BudgetLimitPolicy::class,
        BudgetGoal::class => BudgetGoalPolicy::class,
        BudgetReceipt::class => BudgetReceiptPolicy::class,
        BudgetTransaction::class => BudgetTransactionPolicy::class,
        RecurringTransaction::class => RecurringTransactionPolicy::class,
        WorkoutEntry::class => WorkoutEntryPolicy::class,
        WorkoutPreset::class => WorkoutPresetPolicy::class,
        Exercise::class => ExercisePolicy::class,
        WorkoutRoutine::class => WorkoutRoutinePolicy::class,
        WorkoutSession::class => WorkoutSessionPolicy::class,
        WorkoutSet::class => WorkoutSetPolicy::class,
        BodyMetric::class => BodyMetricPolicy::class,
        ProgressPhoto::class => ProgressPhotoPolicy::class,
        WatchList::class => WatchListPolicy::class,
        WatchListItem::class => WatchListItemPolicy::class,
        HistoryEntry::class => HistoryEntryPolicy::class,
    ];

    public function boot(): void
    {
        foreach (self::POLICIES as $model => $policy) {
            Gate::policy($model, $policy);
        }
    }
}
