<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetReportRequest;
use App\Models\BudgetCategory;
use App\Services\BudgetReports;
use App\Support\BudgetRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/** Reports and due-state: both are reads, both are scoped through the user's relations. */
class BudgetReportController extends Controller
{
    public function __construct(private readonly BudgetReports $reports) {}

    public function index(BudgetReportRequest $request): JsonResponse
    {
        $user = $request->user();
        BudgetCategory::ensureSeeded($user);
        $period = $request->period();

        return response()->json([
            'data' => [
                'period' => $period,
                'currency' => 'ZAR',
                'categories' => $this->reports->categoryTotals(
                    $user,
                    ...array_values(BudgetRules::monthBounds($period)),
                ),
                'monthly' => $this->reports->monthlyInOut($user, $request->months(), Carbon::today()),
                'net_worth' => $this->reports->netWorthTrend($user, $request->months(), Carbon::today()),
                'limits' => $this->reports->limitStates($user, $period),
            ],
        ]);
    }

    public function due(BudgetReportRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->reports->dueState($request->user(), Carbon::today(), $request->period()),
        ]);
    }
}
