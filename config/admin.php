<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Admin login seed
    |--------------------------------------------------------------------------
    |
    | Read by database/seeders/AdminUserSeeder.php. Values are resolved here,
    | not with env() in the seeder itself, because `config:cache` (run on
    | every deploy — see deploy/cpanel-deploy.sh) stops Laravel from loading
    | .env at all; an env() call outside a config file then silently returns
    | null instead of failing loudly.
    |
    */

    'email' => env('ADMIN_EMAIL'),
    'password' => env('ADMIN_PASSWORD'),

];
