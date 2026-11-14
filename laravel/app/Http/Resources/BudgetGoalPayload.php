<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\BudgetGoal;
use App\Support\BudgetRules;

/** One virtual savings jar, with progress computed by the server. */
final class BudgetGoalPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(BudgetGoal $goal): array
    {
        return [
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
        ];
    }

    /**
     * @param  iterable<BudgetGoal>  $goals
     * @return array<int, array<string, mixed>>
     */
    public static function collection(iterable $goals): array
    {
        $payload = [];
        foreach ($goals as $goal) {
            $payload[] = self::from($goal);
        }

        return $payload;
    }
}
