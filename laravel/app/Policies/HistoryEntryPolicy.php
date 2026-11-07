<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\HistoryEntry;
use App\Models\User;

/**
 * History rows are immutable records of a visit: added or removed, never edited,
 * so no update() ability is exposed.
 */
class HistoryEntryPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, HistoryEntry $entry): bool
    {
        return $entry->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function delete(User $user, HistoryEntry $entry): bool
    {
        return $entry->user_id === $user->getKey();
    }
}
