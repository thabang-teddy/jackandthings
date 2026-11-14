<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('watch_lists', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->timestamps();

            $table->unique(['user_id', 'name']);
        });

        Schema::create('watch_list_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('watch_list_id')->constrained('watch_lists')->cascadeOnDelete();
            $table->string('title', 255);
            $table->text('note')->nullable();
            $table->boolean('done')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'created_at'], 'watch_list_items_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('watch_list_items');
        Schema::dropIfExists('watch_lists');
    }
};
