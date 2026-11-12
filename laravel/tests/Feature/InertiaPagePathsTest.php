<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

/**
 * The Inertia page directory, checked for exact case.
 *
 * inertia-laravel defaults to `resources/js/pages`; this app uses
 * `resources/js/Pages`. On Windows and on a default macOS filesystem those
 * are the same directory, so a mismatch is invisible locally and only shows
 * up on Linux - which is where CI runs, and where it failed.
 *
 * `scandir` reports the real directory entry rather than whatever casing was
 * asked for, so this catches the drift on any platform instead of waiting
 * for the next push to main.
 */
class InertiaPagePathsTest extends TestCase
{
    public function test_every_configured_page_path_exists_with_the_case_it_is_written_in(): void
    {
        $paths = config('inertia.pages.paths');

        $this->assertNotEmpty($paths, 'Inertia has no page paths configured.');

        foreach ($paths as $path) {
            $parent = dirname($path);
            $name = basename($path);

            $this->assertDirectoryExists($parent);
            $this->assertContains(
                $name,
                scandir($parent),
                "Inertia is configured to look in [$path], but no directory of "
                .'exactly that name exists. A case-insensitive filesystem will '
                .'hide this; Linux will not.'
            );
        }
    }

    public function test_the_finder_resolves_a_page_that_is_known_to_exist(): void
    {
        $this->assertNotEmpty(
            app('inertia.view-finder')->find('Welcome'),
        );
    }
}
