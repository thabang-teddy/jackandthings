<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BudgetTransactionType;
use App\Enums\RecurringCadence;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A scheduled deposit or withdrawal. The command budget:run-recurring posts the
 * real BudgetTransaction when next_run_at falls due and advances the schedule.
 */
#[Fillable(['account_id', 'type', 'amount_cents', 'description', 'cadence', 'next_run_at', 'active'])]
class RecurringTransaction extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'type' => BudgetTransactionType::class,
            'cadence' => RecurringCadence::class,
            'amount_cents' => 'integer',
            'next_run_at' => 'date',
            'active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(BudgetAccount::class, 'account_id');
    }
}
