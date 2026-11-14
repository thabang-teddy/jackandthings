<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;
use App\Models\WorkoutPreset;

class WorkoutPresetPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, WorkoutPreset $preset): bool
    {
        return $preset->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function delete(User $user, WorkoutPreset $preset): bool
    {
        return $preset->user_id === $user->getKey();
    }
}
