<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Clipboard was replaced by the Watch list feature. Nothing was deployed, so
 * the table is dropped outright rather than migrated.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('clipboard_items');
    }

    public function down(): void
    {
        // One-way removal: the clipboard feature no longer exists.
    }
};
