<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BudgetCategoryKind;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One of the user's spending or income buckets.
 *
 * Seeded on first use with the issue's own five examples plus an income
 * bucket, then renameable and extendable. The seed is per user, so renaming
 * "Groceries" on one account never changes anybody else's list.
 */
#[Fillable(['name', 'kind'])]
class BudgetCategory extends Model
{
    use HasFactory, HasUuids;

    /** @var array<int, array{name: string, kind: string}> */
    public const DEFAULTS = [
        ['name' => 'Groceries', 'kind' => 'expense'],
        ['name' => 'Rent', 'kind' => 'expense'],
        ['name' => 'Dining Out', 'kind' => 'expense'],
        ['name' => 'Entertainment', 'kind' => 'expense'],
        ['name' => 'Transport', 'kind' => 'expense'],
        ['name' => 'Salary', 'kind' => 'income'],
        ['name' => 'Other income', 'kind' => 'income'],
    ];

    protected function casts(): array
    {
        return [
            'kind' => BudgetCategoryKind::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(BudgetTransaction::class, 'category_id');
    }

    public function limits(): HasMany
    {
        return $this->hasMany(BudgetLimit::class, 'category_id');
    }

    /**
     * Gives a user the starter buckets if they have none. Called from the
     * pages and endpoints that read categories, so an existing account that
     * predates issue #5 gets them on its next visit rather than never.
     */
    public static function ensureSeeded(User $user): void
    {
        if ($user->budgetCategories()->exists()) {
            return;
        }

        foreach (self::DEFAULTS as $category) {
            // firstOrCreate rather than insert: two tabs opening Categories at
            // the same moment must not trip the unique index.
            $user->budgetCategories()->firstOrCreate($category);
        }
    }
}
