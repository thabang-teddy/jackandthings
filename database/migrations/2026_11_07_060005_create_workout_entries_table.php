<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workout_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('activity', 100);
            $table->timestamp('logged_at');
            $table->text('notes')->nullable();
            $table->timestamps();

            // Drives both the user's list and the hourly "due for a reminder" check.
            $table->index(['user_id', 'logged_at'], 'workout_entries_user_logged_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workout_entries');
    }
};
