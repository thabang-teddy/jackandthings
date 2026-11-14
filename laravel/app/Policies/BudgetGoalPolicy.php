<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\BudgetGoal;
use App\Models\User;

class BudgetGoalPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, BudgetGoal $goal): bool
    {
        return $goal->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, BudgetGoal $goal): bool
    {
        return $goal->user_id === $user->getKey();
    }

    public function delete(User $user, BudgetGoal $goal): bool
    {
        return $goal->user_id === $user->getKey();
    }
}
