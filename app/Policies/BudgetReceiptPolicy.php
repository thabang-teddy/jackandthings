<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\BudgetReceipt;
use App\Models\User;

class BudgetReceiptPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, BudgetReceipt $receipt): bool
    {
        return $receipt->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function delete(User $user, BudgetReceipt $receipt): bool
    {
        return $receipt->user_id === $user->getKey();
    }
}
