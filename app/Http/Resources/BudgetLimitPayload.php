<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\BudgetLimit;
use App\Support\BudgetRules;

/**
 * One monthly cap, with its state computed by the server. The clients have
 * their own copy of the same integer rule; this reply is the authority.
 */
final class BudgetLimitPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(BudgetLimit $limit, int $spentCents = 0): array
    {
        return [
            'id' => $limit->id,
            'category_id' => $limit->category_id,
            'category' => $limit->category?->name,
            'period' => $limit->period,
            'limit_cents' => $limit->limit_cents,
            'spent_cents' => $spentCents,
            'state' => BudgetRules::limitState($spentCents, $limit->limit_cents),
            'percent' => BudgetRules::limitPercent($spentCents, $limit->limit_cents),
        ];
    }
}
