<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Creates or updates one ordinary User row from ADMIN_EMAIL / ADMIN_PASSWORD.
 * There is no admin role in this app — this account has no more access than
 * any other user, it's just a login for the app owner. Skipped when either
 * env var is unset, so it's safe in CI and other environments without them.
 */
class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL');
        $password = env('ADMIN_PASSWORD');

        if (! $email || ! $password) {
            return;
        }

        User::query()->updateOrCreate(
            ['email' => $email],
            ['name' => 'Admin', 'password' => $password],
        );
    }
}
