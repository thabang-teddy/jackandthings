<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\ProgressPhoto;
use App\Models\User;

/**
 * Guards the image as well as the row: the download action authorizes `view`
 * before it streams a file off the private disk, so a photo is unreachable to
 * anybody but its owner even with the id in hand.
 */
class ProgressPhotoPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ProgressPhoto $photo): bool
    {
        return $photo->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, ProgressPhoto $photo): bool
    {
        return $photo->user_id === $user->getKey();
    }

    public function delete(User $user, ProgressPhoto $photo): bool
    {
        return $photo->user_id === $user->getKey();
    }
}
