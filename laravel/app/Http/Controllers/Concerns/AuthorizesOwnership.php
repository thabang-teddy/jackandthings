<?php

declare(strict_types=1);

namespace App\Http\Controllers\Concerns;

use Illuminate\Database\Eloquent\Model;

trait AuthorizesOwnership
{
    /**
     * Ownership failures abort with 404 rather than 403: a 403 would confirm that
     * the record exists, which leaks one user's data to another. Every bound
     * record in this application belongs to exactly one user.
     */
    protected function authorizeOwned(string $ability, Model $model): void
    {
        abort_unless(request()->user()?->can($ability, $model) ?? false, 404);
    }
}
