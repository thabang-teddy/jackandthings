<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\ClipboardItem;
use App\Models\User;

class ClipboardItemPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ClipboardItem $item): bool
    {
        return $item->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, ClipboardItem $item): bool
    {
        return $item->user_id === $user->getKey();
    }

    public function delete(User $user, ClipboardItem $item): bool
    {
        return $item->user_id === $user->getKey();
    }
}
