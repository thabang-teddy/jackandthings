<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->boolean('is_starred')->default(false)->after('body');

            // The home page reads starred notes only, newest first; the
            // existing notes_user_index cannot serve that filter.
            $table->index(['user_id', 'is_starred', 'created_at'], 'notes_user_starred_index');
        });
    }

    public function down(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->dropIndex('notes_user_starred_index');
            $table->dropColumn('is_starred');
        });
    }
};
