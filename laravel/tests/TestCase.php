<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // app.blade.php loads a per-page Vite entry, so without a build every
        // page-rendering test fails with "Vite manifest not found" — which is
        // what happened in CI, where public/build does not exist. That is a
        // missing artefact, not a broken application, and it also made a fresh
        // clone unable to run the suite until `npm run build`.
        //
        // The js job owns the bundle: it runs `npm run build`, so a bad entry
        // still fails there. This suite asserts behaviour, so it renders pages
        // with an empty asset tag instead of depending on a build.
        $this->withoutVite();
    }
}
