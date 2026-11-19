<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\BudgetTransactionType;
use App\Exceptions\InsufficientFundsException;
use App\Models\RecurringTransaction;
use App\Services\BudgetService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Posts every recurring deposit/withdrawal that has fallen due and advances its
 * schedule. A withdrawal that would overdraw is skipped for that occurrence but
 * still advances, so a short month does not leave the schedule stuck.
 */
class RunRecurringTransactions extends Command
{
    protected $signature = 'budget:run-recurring';

    protected $description = 'Post due recurring budget transactions and advance their schedules';

    public function handle(BudgetService $budget): int
    {
        $today = Carbon::today();
        $posted = 0;

        RecurringTransaction::query()
            ->where('active', true)
            ->whereDate('next_run_at', '<=', $today)
            ->with('account', 'user')
            ->chunkById(100, function ($items) use ($budget, $today, &$posted): void {
                foreach ($items as $recurring) {
                    $posted += $this->runOne($budget, $recurring, $today);
                }
            });

        $this->info("Posted {$posted} recurring transaction(s).");

        return self::SUCCESS;
    }

    private function runOne(BudgetService $budget, RecurringTransaction $recurring, Carbon $today): int
    {
        $posted = 0;
        $next = $recurring->next_run_at->copy();

        // Catch up any missed occurrences, capped so a far-past date cannot loop
        // indefinitely.
        for ($guard = 0; $guard < 400 && $next->lessThanOrEqualTo($today); $guard++) {
            if ($this->post($budget, $recurring)) {
                $posted++;
            }

            $next = $recurring->cadence->advance($next);
        }

        $recurring->update(['next_run_at' => $next]);

        return $posted;
    }

    private function post(BudgetService $budget, RecurringTransaction $recurring): bool
    {
        if ($recurring->user === null || $recurring->account === null) {
            return false;
        }

        // The occurrence date, not "now": a month the command missed should
        // land in the month it belonged to, so reports and limits stay honest.
        $occurredOn = $recurring->next_run_at?->toDateString();

        if ($recurring->type === BudgetTransactionType::Deposit) {
            $budget->deposit(
                $recurring->user,
                $recurring->account,
                $recurring->amount_cents,
                $recurring->description,
                $occurredOn,
                null,
                $recurring->category_id,
            );

            return true;
        }

        try {
            $budget->withdraw(
                $recurring->user,
                $recurring->account,
                $recurring->amount_cents,
                $recurring->description,
                $occurredOn,
                null,
                $recurring->category_id,
            );
        } catch (InsufficientFundsException) {
            // Skip this occurrence rather than overdraw the account.
            return false;
        }

        return true;
    }
}
