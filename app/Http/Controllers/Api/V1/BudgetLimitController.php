<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetLimitRequest;
use App\Http\Resources\BudgetLimitPayload;
use App\Models\BudgetCategory;
use App\Models\BudgetLimit;
use App\Services\BudgetReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class BudgetLimitController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly BudgetReports $reports) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        BudgetCategory::ensureSeeded($user);
        $period = $this->period($request);

        return response()->json([
            'data' => $this->reports->limitStates($user, $period),
            'meta' => ['period' => $period, 'currency' => 'ZAR'],
        ]);
    }

    /**
     * One cap per category per month: setting it again edits the existing row
     * rather than creating a second cap for the same month.
     */
    public function store(BudgetLimitRequest $request): JsonResponse
    {
        $limit = $request->user()->budgetLimits()->updateOrCreate(
            [
                'category_id' => $request->string('category_id')->value(),
                'period' => $request->string('period')->value(),
            ],
            ['limit_cents' => $request->limitCents()],
        );

        return response()->json([
            'data' => $this->payload($limit, $request->string('period')->value()),
        ], 201);
    }

    public function show(BudgetLimit $limit): JsonResponse
    {
        $this->authorizeOwned('view', $limit);

        return response()->json(['data' => $this->payload($limit, $limit->period)]);
    }

    public function update(BudgetLimitRequest $request, BudgetLimit $limit): JsonResponse
    {
        $this->authorizeOwned('update', $limit);

        $limit->update($request->attributesForModel());

        return response()->json(['data' => $this->payload($limit->refresh(), $limit->period)]);
    }

    public function destroy(BudgetLimit $limit): JsonResponse
    {
        $this->authorizeOwned('delete', $limit);

        $limit->delete();

        return response()->json(status: 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(BudgetLimit $limit, string $period): array
    {
        $states = $this->reports->limitStates($limit->user, $period);

        foreach ($states as $state) {
            if ($state['id'] === $limit->id) {
                return $state;
            }
        }

        $limit->loadMissing('category:id,name');

        return BudgetLimitPayload::from($limit);
    }

    private function period(Request $request): string
    {
        $period = $request->string('period')->value();

        return preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period) === 1
            ? $period
            : Carbon::today()->format('Y-m');
    }
}
