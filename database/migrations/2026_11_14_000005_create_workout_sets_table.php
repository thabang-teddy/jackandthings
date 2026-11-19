<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A single set. The table the whole module is really about: personal records,
 * progressive overload and training volume are all read from here.
 *
 * It carries `user_id` directly even though it could be reached through its
 * session, so every ownership scope is one hop - the same call
 * budget_transactions makes. The composite index below is what makes "what did
 * I lift last time" and "is this a PR" cheap during a live workout.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workout_sets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('workout_session_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('exercise_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('position');
            // A warm-up set is logged but never counts towards a personal
            // record, and is excluded from volume.
            $table->boolean('is_warmup')->default(false);
            $table->unsignedSmallInteger('reps')->nullable();
            $table->unsignedInteger('weight_grams')->nullable();
            $table->unsignedInteger('distance_metres')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            // Rate of perceived exertion, 1-10. Optional everywhere.
            $table->unsignedTinyInteger('rpe')->nullable();
            $table->timestamp('completed_at');
            $table->timestamps();

            // Serves the progressive-overload lookup and the PR queries:
            // "this user, this exercise, most recent first".
            $table->index(['user_id', 'exercise_id', 'completed_at'], 'workout_sets_user_exercise_index');
            // Serves a session's own set list, in order.
            $table->index(['workout_session_id', 'position'], 'workout_sets_session_order_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workout_sets');
    }
};
