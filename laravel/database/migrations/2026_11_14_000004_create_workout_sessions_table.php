<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One trip to the gym. Open while it runs (`finished_at` null), closed when
 * the user finishes it.
 *
 * Unlike a Pomodoro interval - which is only ever written once it has already
 * ended - a workout session is written at the start and updated at the end,
 * because the sets logged against it have to attach to something while the
 * workout is still happening. The countdown between sets is still client-side
 * and is never persisted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workout_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Null for a freestyle session with no routine behind it. Nulled
            // rather than cascaded if the routine is later deleted: the
            // session happened, and deleting the template must not erase it.
            $table->foreignUuid('workout_routine_id')->nullable()->constrained()->nullOnDelete();
            // Kept so the history still reads correctly after the routine is
            // renamed or deleted, the way pomodoro_sessions keeps preset_name.
            $table->string('routine_name', 80)->nullable();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'started_at'], 'workout_sessions_user_started_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workout_sessions');
    }
};
