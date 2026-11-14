<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;
use App\Models\WorkoutEntry;

class WorkoutEntryPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, WorkoutEntry $entry): bool
    {
        return $entry->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, WorkoutEntry $entry): bool
    {
        return $entry->user_id === $user->getKey();
    }

    public function delete(User $user, WorkoutEntry $entry): bool
    {
        return $entry->user_id === $user->getKey();
    }
}
