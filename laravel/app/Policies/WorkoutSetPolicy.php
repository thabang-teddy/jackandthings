<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;
use App\Models\WorkoutSet;

class WorkoutSetPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, WorkoutSet $set): bool
    {
        return $set->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, WorkoutSet $set): bool
    {
        return $set->user_id === $user->getKey();
    }

    public function delete(User $user, WorkoutSet $set): bool
    {
        return $set->user_id === $user->getKey();
    }
}
