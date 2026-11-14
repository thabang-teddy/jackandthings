<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Enums\BudgetCategoryKind;
use App\Http\Controllers\Controller;
use App\Http\Resources\BudgetAccountPayload;
use App\Http\Resources\BudgetTransactionPayload;
use App\Models\BudgetCategory;
use App\Models\BudgetGoal;
use App\Models\RecurringTransaction;
use App\Models\User;
use App\Services\BudgetReports;
use App\Services\BudgetService;
use App\Support\BudgetRules;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BudgetController extends Controller
{
    public function __construct(
        private readonly BudgetService $budget,
        private readonly BudgetReports $reports,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        BudgetCategory::ensureSeeded($user);

        return Inertia::render('Budget/Overview', [
            'accounts' => $this->accountsWithBalances($user),
            'transactions' => $this->recentTransactions($user, 25),
            'totalCents' => array_sum($this->budget->balancesFor($user)),
            'due' => $this->reports->dueState($user),
        ]);
    }

    public function cards(Request $request): Response
    {
        return Inertia::render('Budget/Cards', [
            'accounts' => $this->accountsWithBalances($request->user()),
        ]);
    }

    public function transfer(Request $request): Response
    {
        return Inertia::render('Budget/Transfer', [
            'accounts' => $this->accountsWithBalances($request->user()),
        ]);
    }

    public function transactions(Request $request): Response
    {
        $user = $request->user();
        BudgetCategory::ensureSeeded($user);

        return Inertia::render('Budget/Transactions', [
            'accounts' => $this->accountsWithBalances($user),
            'categories' => $this->categoryOptions($user),
            'transactions' => $this->recentTransactions($user, 50),
        ]);
    }

    public function recurring(Request $request): Response
    {
        $user = $request->user();
        BudgetCategory::ensureSeeded($user);

        $items = $user->recurringTransactions()
            ->with(['account:id,name', 'category:id,name'])
            ->orderBy('next_run_at')
            ->get()
            ->map(fn (RecurringTransaction $recurring): array => [
                'id' => $recurring->id,
                'account_id' => $recurring->account_id,
                'account' => $recurring->account?->name,
                'category_id' => $recurring->category_id,
                'category' => $recurring->category?->name,
                'type' => $recurring->type->value,
                'amount_cents' => $recurring->amount_cents,
                'description' => $recurring->description,
                'cadence' => $recurring->cadence->value,
                'next_run_at' => $recurring->next_run_at?->toDateString(),
                'active' => $recurring->active,
                'remind_days_before' => $recurring->remind_days_before,
            ]);

        return Inertia::render('Budget/Recurring', [
            'accounts' => $this->accountsWithBalances($user),
            'categories' => $this->categoryOptions($user),
            'recurring' => $items,
        ]);
    }

    public function categories(Request $request): Response
    {
        $user = $request->user();
        BudgetCategory::ensureSeeded($user);

        return Inertia::render('Budget/Categories', [
            'categories' => $this->categoryOptions($user),
        ]);
    }

    public function limits(Request $request): Response
    {
        $user = $request->user();
        BudgetCategory::ensureSeeded($user);
        $period = $this->period($request);

        return Inertia::render('Budget/Limits', [
            'period' => $period,
            'categories' => $this->categoryOptions($user, BudgetCategoryKind::Expense),
            'limits' => $this->reports->limitStates($user, $period),
        ]);
    }

    public function goals(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Budget/Goals', [
            'accounts' => $this->accountsWithBalances($user),
            'goals' => $user->budgetGoals()
                ->with('account:id,name')
                ->orderBy('archived_at')
                ->orderBy('target_date')
                ->get()
                ->map(fn (BudgetGoal $goal): array => [
                    'id' => $goal->id,
                    'name' => $goal->name,
                    'target_cents' => $goal->target_cents,
                    'saved_cents' => $goal->saved_cents,
                    'remaining_cents' => max(0, $goal->target_cents - $goal->saved_cents),
                    'percent' => BudgetRules::goalPercent($goal->saved_cents, $goal->target_cents),
                    'complete' => BudgetRules::goalComplete($goal->saved_cents, $goal->target_cents),
                    'account_id' => $goal->account_id,
                    'account' => $goal->account?->name,
                    'target_date' => $goal->target_date?->toDateString(),
                    'archived_at' => $goal->archived_at?->toIso8601String(),
                ]),
        ]);
    }

    public function reports(Request $request): Response
    {
        $user = $request->user();
        BudgetCategory::ensureSeeded($user);
        $period = $this->period($request);
        $months = min(24, max(1, (int) $request->integer('months', 6)));
        $bounds = BudgetRules::monthBounds($period);

        return Inertia::render('Budget/Reports', [
            'period' => $period,
            'months' => $months,
            'categories' => $this->reports->categoryTotals($user, $bounds['start'], $bounds['end']),
            'monthly' => $this->reports->monthlyInOut($user, $months),
            'netWorth' => $this->reports->netWorthTrend($user, $months),
            'limits' => $this->reports->limitStates($user, $period),
        ]);
    }

    /**
     * Every transaction as CSV, streamed so a long ledger is not held in
     * memory. CSV only: it opens in Excel, and a real .xlsx would mean adding
     * PhpSpreadsheet to a project that has avoided that dependency.
     */
    public function export(Request $request): StreamedResponse
    {
        $user = $request->user();
        $filename = 'budget-'.$user->getKey().'-'.Carbon::today()->toDateString().'.csv';

        return response()->streamDownload(function () use ($user): void {
            $handle = fopen('php://output', 'wb');

            if ($handle === false) {
                return;
            }

            // UTF-8 BOM so Excel reads the ZAR symbols and accented merchants.
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Date', 'Type', 'Account', 'Category', 'Merchant', 'Description', 'Amount (ZAR)', 'Amount (cents)']);

            $user->budgetTransactions()
                ->with(['account:id,name', 'category:id,name'])
                ->orderBy('occurred_on')
                ->orderBy('created_at')
                ->chunk(200, function ($transactions) use ($handle): void {
                    foreach ($transactions as $transaction) {
                        fputcsv($handle, [
                            $transaction->occurred_on?->toDateString(),
                            $transaction->type->value,
                            $transaction->account?->name,
                            $transaction->category?->name,
                            $transaction->merchant,
                            $transaction->description,
                            $this->zar($transaction->amount_cents),
                            $transaction->amount_cents,
                        ]);
                    }
                });

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function accountsWithBalances(User $user)
    {
        $balances = $this->budget->balancesFor($user);

        return BudgetAccountPayload::collection(
            $user->budgetAccounts()->orderBy('archived_at')->orderBy('name')->get(),
            $balances,
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recentTransactions(User $user, int $limit)
    {
        return BudgetTransactionPayload::collection(
            $user->budgetTransactions()
                ->with(['account:id,name', 'relatedAccount:id,name', 'category:id,name', 'receipt'])
                ->orderByDesc('occurred_on')
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get(),
            BudgetTransactionPayload::WEB_FILE_ROUTE,
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function categoryOptions(User $user, ?BudgetCategoryKind $kind = null): array
    {
        $query = $user->budgetCategories()->orderBy('kind')->orderBy('name');

        if ($kind !== null) {
            $query->where('kind', $kind->value);
        }

        return $query->get()
            ->map(fn (BudgetCategory $category): array => [
                'id' => $category->id,
                'name' => $category->name,
                'kind' => $category->kind->value,
            ])
            ->all();
    }

    private function period(Request $request): string
    {
        $period = $request->string('period')->value();

        return preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period) === 1
            ? $period
            : Carbon::today()->format('Y-m');
    }

    /** Cents to a decimal string without a float ever touching the value. */
    private function zar(int $cents): string
    {
        return sprintf('%d.%02d', intdiv($cents, 100), $cents % 100);
    }
}
