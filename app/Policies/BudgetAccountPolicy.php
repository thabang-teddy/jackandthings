<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\BudgetAccount;
use App\Models\User;

class BudgetAccountPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, BudgetAccount $account): bool
    {
        return $account->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, BudgetAccount $account): bool
    {
        return $account->user_id === $user->getKey();
    }

    public function delete(User $user, BudgetAccount $account): bool
    {
        return $account->user_id === $user->getKey();
    }
}
