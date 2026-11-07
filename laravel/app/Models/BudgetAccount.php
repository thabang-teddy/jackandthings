<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BudgetTransactionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name'])]
class BudgetAccount extends Model
{
    use HasFactory, HasUuids;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(BudgetTransaction::class, 'account_id');
    }

    /**
     * Balance is derived from the ledger rather than stored, so it cannot drift.
     * Use BudgetService::balancesFor() when listing several accounts at once.
     */
    public function balanceCents(): int
    {
        $credits = (int) $this->transactions()
            ->whereIn('type', BudgetTransactionType::creditValues())
            ->sum('amount_cents');

        $debits = (int) $this->transactions()
            ->whereIn('type', BudgetTransactionType::debitValues())
            ->sum('amount_cents');

        return $credits - $debits;
    }
}
