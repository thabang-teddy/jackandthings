<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Exercise;
use App\Models\User;

/**
 * The only policy in this application guarding a table with unowned rows.
 *
 * A seeded catalog exercise (`user_id` null) is readable by everybody and
 * editable by nobody. A user's own exercise behaves like every other record
 * here. There is no case in which one user reaches another user's exercise.
 */
class ExercisePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Exercise $exercise): bool
    {
        return $exercise->isGlobal() || $exercise->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Note the deliberate asymmetry with view(): a catalog row is readable but
     * never writable, so `isGlobal()` is not an escape hatch here. Without
     * this, one user editing a seeded exercise would change it for everybody.
     */
    public function update(User $user, Exercise $exercise): bool
    {
        return $exercise->user_id === $user->getKey();
    }

    public function delete(User $user, Exercise $exercise): bool
    {
        return $exercise->user_id === $user->getKey();
    }
}
