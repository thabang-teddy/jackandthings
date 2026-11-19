<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Pages
    |--------------------------------------------------------------------------
    |
    | Only this block is overridden; everything else in inertia-laravel's own
    | config still applies, since its service provider merges that file in
    | underneath this one. The merge is shallow, so the whole `pages` key has
    | to be restated rather than just the one line that differs.
    |
    | What differs is `paths`. The package looks in `resources/js/pages`, and
    | this app has always used `resources/js/Pages`. On a case-insensitive
    | filesystem (Windows, macOS by default) the two are the same directory,
    | so nothing noticed; on Linux they are not, and `assertInertia(...)
    | ->component(...)` failed in CI with "page component file does not
    | exist" while passing on the machine it was written on.
    |
    | Worth fixing here rather than in the tests: the same finder backs
    | ResponseFactory's render-time check, so with `ensure_pages_exist` on it
    | would have reported every page in the app as missing in production.
    |
    */

    'pages' => [

        // Left off, as the package has it. The check costs a stat on every
        // render, and the suite already asserts the component by name.
        'ensure_pages_exist' => false,

        'paths' => [

            resource_path('js/Pages'),

        ],

        'extensions' => [

            'js',
            'jsx',
            'svelte',
            'ts',
            'tsx',
            'vue',

        ],

    ],

];
