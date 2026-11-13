<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;
use App\Models\WorkoutRoutine;

class WorkoutRoutinePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, WorkoutRoutine $routine): bool
    {
        return $routine->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, WorkoutRoutine $routine): bool
    {
        return $routine->user_id === $user->getKey();
    }

    public function delete(User $user, WorkoutRoutine $routine): bool
    {
        return $routine->user_id === $user->getKey();
    }
}
