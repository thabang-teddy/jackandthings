<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\PomodoroPreset;
use App\Models\User;

class PomodoroPresetPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, PomodoroPreset $preset): bool
    {
        return $preset->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, PomodoroPreset $preset): bool
    {
        return $preset->user_id === $user->getKey();
    }

    public function delete(User $user, PomodoroPreset $preset): bool
    {
        return $preset->user_id === $user->getKey();
    }
}
