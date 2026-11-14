<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\BudgetCategory;
use App\Models\User;

class BudgetCategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, BudgetCategory $category): bool
    {
        return $category->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, BudgetCategory $category): bool
    {
        return $category->user_id === $user->getKey();
    }

    public function delete(User $user, BudgetCategory $category): bool
    {
        return $category->user_id === $user->getKey();
    }
}
