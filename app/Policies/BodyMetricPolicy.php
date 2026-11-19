<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\BodyMetric;
use App\Models\User;

class BodyMetricPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, BodyMetric $metric): bool
    {
        return $metric->user_id === $user->getKey();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, BodyMetric $metric): bool
    {
        return $metric->user_id === $user->getKey();
    }

    public function delete(User $user, BodyMetric $metric): bool
    {
        return $metric->user_id === $user->getKey();
    }
}
