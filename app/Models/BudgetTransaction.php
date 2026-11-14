<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BudgetTransactionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['account_id', 'type', 'amount_cents', 'related_account_id', 'transfer_group_id', 'description', 'occurred_on', 'merchant', 'category_id'])]
class BudgetTransaction extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'type' => BudgetTransactionType::class,
            'amount_cents' => 'integer',
            'occurred_on' => 'date',
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

    public function relatedAccount(): BelongsTo
    {
        return $this->belongsTo(BudgetAccount::class, 'related_account_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(BudgetCategory::class, 'category_id');
    }

    public function receipt(): HasOne
    {
        return $this->hasOne(BudgetReceipt::class, 'transaction_id');
    }
}
