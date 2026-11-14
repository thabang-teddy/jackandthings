<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('history_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('url', 2048);
            $table->string('title')->nullable();
            $table->timestamp('visited_at');

            // 'manual' | 'seed' today; future browser extensions will write 'extension'.
            $table->string('source', 20)->nullable();
            $table->timestamps();

            // Hard deletes only: history:prune must actually remove rows, so there is
            // deliberately no deleted_at column here.
            $table->index(['user_id', 'visited_at'], 'history_entries_user_visited_index');
            $table->index('visited_at', 'history_entries_visited_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('history_entries');
    }
};
