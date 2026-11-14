<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\BudgetTransaction;
use App\Models\User;

/**
 * Posted transactions are an immutable ledger: they can be created and deleted,
 * never edited, so no update() ability is exposed.
 */
class BudgetTransactionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, BudgetTransaction $transaction): bool
    {
        return $transaction->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function delete(User $user, BudgetTransaction $transaction): bool
    {
        return $transaction->user_id === $user->getKey();
    }
}
