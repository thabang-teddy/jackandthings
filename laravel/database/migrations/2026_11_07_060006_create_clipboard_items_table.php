<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clipboard_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 100)->nullable();
            $table->text('content');

            // Written by future Android/browser-extension clients; the web UI leaves it null.
            $table->string('source_device', 30)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at'], 'clipboard_items_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clipboard_items');
    }
};
