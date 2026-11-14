<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A virtual savings jar. `saved_cents` is a figure the user maintains; it is
 * deliberately not moved between accounts - see the goals migration.
 */
#[Fillable(['name', 'target_cents', 'saved_cents', 'account_id', 'target_date', 'archived_at'])]
class BudgetGoal extends Model
{
    use HasFactory, HasUuids;

    protected function casts(): array
    {
        return [
            'target_cents' => 'integer',
            'saved_cents' => 'integer',
            'target_date' => 'date',
            'archived_at' => 'datetime',
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
