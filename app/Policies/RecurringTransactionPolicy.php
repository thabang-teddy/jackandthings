<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\RecurringTransaction;
use App\Models\User;

class RecurringTransactionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, RecurringTransaction $recurring): bool
    {
        return $recurring->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, RecurringTransaction $recurring): bool
    {
        return $recurring->user_id === $user->getKey();
    }

    public function delete(User $user, RecurringTransaction $recurring): bool
    {
        return $recurring->user_id === $user->getKey();
    }
}
