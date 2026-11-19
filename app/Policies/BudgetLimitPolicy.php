<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\BudgetLimit;
use App\Models\User;

class BudgetLimitPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, BudgetLimit $limit): bool
    {
        return $limit->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, BudgetLimit $limit): bool
    {
        return $limit->user_id === $user->getKey();
    }

    public function delete(User $user, BudgetLimit $limit): bool
    {
        return $limit->user_id === $user->getKey();
    }
}
