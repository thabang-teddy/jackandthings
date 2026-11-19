<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BudgetCategoryKind;
use App\Enums\BudgetTransactionType;
use App\Models\BudgetLimit;
use App\Models\RecurringTransaction;
use App\Models\User;
use App\Support\BudgetRules;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Every Budget read that aggregates, in one place.
 *
 * The shape follows BudgetService::balancesFor(): a report is a small fixed
 * number of grouped queries, never one query per category or per month. The
 * pages then render what they fetched instead of asking again per row.
 */
class BudgetReports
{
    /**
     * Spending and income by category for a date range, in one grouped query.
     *
     * Transfers are excluded: moving money between your own accounts is not
     * spending or income, and counting both legs would inflate every report.
     *
     * @return array<int, array{category_id: ?string, name: string, kind: string, spent_cents: int, income_cents: int}>
     */
    public function categoryTotals(User $user, string $from, string $to): array
    {
        $rows = $user->budgetTransactions()
            ->leftJoin('budget_categories', 'budget_categories.id', '=', 'budget_transactions.category_id')
            ->whereBetween('budget_transactions.occurred_on', [$from, $to])
            ->whereIn('budget_transactions.type', BudgetTransactionType::directValues())
            ->selectRaw(
                'budget_transactions.category_id as category_id, '
                .'budget_categories.name as category_name, '
                .'budget_categories.kind as category_kind, '
                .'budget_transactions.type as type, '
                .'SUM(budget_transactions.amount_cents) as total'
            )
            ->groupBy(
                'budget_transactions.category_id',
                'budget_categories.name',
                'budget_categories.kind',
                'budget_transactions.type',
            )
            ->get();

        $buckets = [];

        foreach ($rows as $row) {
            $key = (string) ($row->category_id ?? 'uncategorized');
            $credit = in_array((string) $row->type, BudgetTransactionType::creditValues(), true);
            $total = (int) $row->total;

            $buckets[$key] ??= [
                'category_id' => $row->category_id,
                'name' => $row->category_name ?? 'Uncategorized',
                'kind' => $row->category_kind ?? ($credit ? BudgetCategoryKind::Income->value : BudgetCategoryKind::Expense->value),
                'spent_cents' => 0,
                'income_cents' => 0,
            ];

            if ($credit) {
                $buckets[$key]['income_cents'] += $total;
            } else {
                $buckets[$key]['spent_cents'] += $total;
            }
        }

        return array_values($buckets);
    }

    /**
     * Income versus expenses for the last N months, including empty months so
     * a bar chart has a continuous axis.
     *
     * @return array<int, array{period: string, income_cents: int, expense_cents: int}>
     */
    public function monthlyInOut(User $user, int $months = 6, ?Carbon $asOf = null): array
    {
        $months = max(1, min(24, $months));
        $end = ($asOf ?? Carbon::today())->copy()->startOfMonth();
        $start = $end->copy()->subMonths($months - 1);
        $current = $end->format('Y-m');

        $rows = $user->budgetTransactions()
            ->whereIn('type', BudgetTransactionType::directValues())
            ->whereDate('occurred_on', '>=', $start->toDateString())
            ->selectRaw("strftime('%Y-%m', occurred_on) as period, type, SUM(amount_cents) as total")
            ->groupBy('period', 'type')
            ->get();

        $totals = [];
        foreach ($rows as $row) {
            $period = (string) $row->period;
            $totals[$period] ??= ['income_cents' => 0, 'expense_cents' => 0];
            $credit = in_array((string) $row->type, BudgetTransactionType::creditValues(), true);
            $totals[$period][$credit ? 'income_cents' : 'expense_cents'] += (int) $row->total;
        }

        $series = [];
        for ($offset = $months - 1; $offset >= 0; $offset--) {
            $period = BudgetRules::shiftPeriod($current, -$offset);
            $series[] = [
                'period' => $period,
                'income_cents' => $totals[$period]['income_cents'] ?? 0,
                'expense_cents' => $totals[$period]['expense_cents'] ?? 0,
            ];
        }

        return $series;
    }

    /**
     * Net worth at the end of each of the last N months.
     *
     * Net worth is every account balance combined, so opening figures count
     * once and transfer legs cancel each other. Rows are fetched grouped by
     * month and accumulated in PHP, which keeps the query count at one
     * regardless of how long the history is.
     *
     * @return array<int, array{period: string, net_cents: int}>
     */
    public function netWorthTrend(User $user, int $months = 6, ?Carbon $asOf = null): array
    {
        $months = max(1, min(24, $months));
        $end = ($asOf ?? Carbon::today())->copy()->startOfMonth();
        $current = $end->format('Y-m');
        $periods = [];
        for ($offset = $months - 1; $offset >= 0; $offset--) {
            $periods[] = BudgetRules::shiftPeriod($current, -$offset);
        }

        $opening = (int) $user->budgetAccounts()->sum('opening_balance_cents');

        $rows = $user->budgetTransactions()
            ->selectRaw("strftime('%Y-%m', occurred_on) as period, type, SUM(amount_cents) as total")
            ->groupBy('period', 'type')
            ->orderBy('period')
            ->get();

        $pointInTime = [];
        $running = $opening;
        foreach ($rows as $row) {
            $credit = in_array((string) $row->type, BudgetTransactionType::creditValues(), true);
            $running += $credit ? (int) $row->total : -(int) $row->total;
            $pointInTime[(string) $row->period] = $running;
        }

        $orderedPeriods = array_keys($pointInTime);
        sort($orderedPeriods);

        $series = [];
        $last = $opening;
        $pointer = 0;

        foreach ($periods as $period) {
            while ($pointer < count($orderedPeriods) && $orderedPeriods[$pointer] <= $period) {
                $last = $pointInTime[$orderedPeriods[$pointer]];
                $pointer++;
            }

            $series[] = ['period' => $period, 'net_cents' => $last];
        }

        return $series;
    }

    /**
     * The state of every cap set for a month, computed against the ledger.
     *
     * @return array<int, array{id: string, category_id: string, category: string, limit_cents: int, spent_cents: int, state: string, percent: int}>
     */
    public function limitStates(User $user, string $period): array
    {
        $bounds = BudgetRules::monthBounds($period);

        /** @var Collection<int, BudgetLimit> $limits */
        $limits = $user->budgetLimits()
            ->with('category:id,name')
            ->where('period', $period)
            ->get();

        if ($limits->isEmpty()) {
            return [];
        }

        $spent = $this->spentByCategory($user, $bounds['start'], $bounds['end']);

        return $limits->map(function (BudgetLimit $limit) use ($spent): array {
            $spentCents = $spent[(string) $limit->category_id] ?? 0;

            return [
                'id' => $limit->id,
                'category_id' => $limit->category_id,
                'category' => $limit->category?->name ?? 'Category',
                'limit_cents' => $limit->limit_cents,
                'spent_cents' => $spentCents,
                'state' => BudgetRules::limitState($spentCents, $limit->limit_cents),
                'percent' => BudgetRules::limitPercent($spentCents, $limit->limit_cents),
            ];
        })->values()->all();
    }

    /**
     * Everything a client polls for: bills inside their reminder window and
     * caps that are near or over. The server never notifies; see
     * docs/ARCHITECTURE.md.
     *
     * @return array{today: string, bills: array<int, array<string, mixed>>, limits: array<int, array<string, mixed>>}
     */
    public function dueState(User $user, ?Carbon $today = null, ?string $period = null): array
    {
        $day = ($today ?? Carbon::today())->copy()->startOfDay();
        $period ??= $day->format('Y-m');

        /** @var Collection<int, RecurringTransaction> $recurring */
        $recurring = $user->recurringTransactions()
            ->where('active', true)
            ->whereNotNull('remind_days_before')
            ->with('account:id,name')
            ->orderBy('next_run_at')
            ->get();

        $bills = $recurring
            ->filter(function (RecurringTransaction $bill) use ($day): bool {
                $next = $bill->next_run_at?->copy()->startOfDay();
                $window = (int) $bill->remind_days_before;

                return $next !== null && $next->lessThanOrEqualTo($day->copy()->addDays($window));
            })
            ->map(function (RecurringTransaction $bill) use ($day): array {
                $next = $bill->next_run_at?->copy()->startOfDay();

                return [
                    'id' => $bill->id,
                    'description' => $bill->description,
                    'account' => $bill->account?->name,
                    'amount_cents' => $bill->amount_cents,
                    'next_run_at' => $next?->toDateString(),
                    'days_until_due' => $next === null ? null : (int) $day->diffInDays($next, false),
                    'remind_days_before' => $bill->remind_days_before,
                ];
            })
            ->values()
            ->all();

        $limits = array_values(array_filter(
            $this->limitStates($user, $period),
            fn (array $limit): bool => in_array($limit['state'], [BudgetRules::STATE_NEAR, BudgetRules::STATE_OVER], true),
        ));

        return [
            'today' => $day->toDateString(),
            'bills' => $bills,
            'limits' => $limits,
        ];
    }

    /**
     * Spending per category for a range, in one query. Uncategorized rows do
     * not belong to a limit and are deliberately absent.
     *
     * @return array<string, int>
     */
    private function spentByCategory(User $user, string $from, string $to): array
    {
        $rows = $user->budgetTransactions()
            ->whereNotNull('category_id')
            ->whereIn('type', BudgetTransactionType::debitValues())
            ->whereBetween('occurred_on', [$from, $to])
            ->selectRaw('category_id, SUM(amount_cents) as total')
            ->groupBy('category_id')
            ->get();

        $spent = [];
        foreach ($rows as $row) {
            $spent[(string) $row->category_id] = (int) $row->total;
        }

        return $spent;
    }
}
