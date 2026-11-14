<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;
use App\Models\WatchList;

class WatchListPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, WatchList $list): bool
    {
        return $list->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, WatchList $list): bool
    {
        return $list->user_id === $user->getKey();
    }

    public function delete(User $user, WatchList $list): bool
    {
        return $list->user_id === $user->getKey();
    }
}
