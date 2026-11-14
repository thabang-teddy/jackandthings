<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BudgetAccountKind;
use App\Enums\BudgetTransactionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A wallet: cash, a cheque account, a credit card or an e-wallet.
 *
 * `opening_balance_cents` is the only stored balance and it is a starting
 * figure, not a running one. The current balance remains derived from the
 * ledger, so it cannot drift.
 */
#[Fillable(['name', 'kind', 'opening_balance_cents', 'archived_at'])]
class BudgetAccount extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'kind' => BudgetAccountKind::class,
            'opening_balance_cents' => 'integer',
            'archived_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(BudgetTransaction::class, 'account_id');
    }

    /**
     * Balance is derived from the opening figure plus the ledger, so it cannot
     * drift. Use BudgetService::balancesFor() when listing several accounts.
     */
    public function balanceCents(): int
    {
        $credits = (int) $this->transactions()
            ->whereIn('type', BudgetTransactionType::creditValues())
            ->sum('amount_cents');

        $debits = (int) $this->transactions()
            ->whereIn('type', BudgetTransactionType::debitValues())
            ->sum('amount_cents');

        return $this->opening_balance_cents + $credits - $debits;
    }
}
