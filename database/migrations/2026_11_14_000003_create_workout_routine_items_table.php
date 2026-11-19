<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One exercise's place in a routine, with what to aim for.
 *
 * Every target is nullable: which ones are meaningful depends on the
 * exercise's metric (see App\Enums\ExerciseMetric). A plank carries a target
 * duration and no weight; a bench press the reverse.
 *
 * There is no user_id here - the row is reached only through its routine, and
 * the routine is the thing a policy guards. Deleting the routine takes its
 * items with it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workout_routine_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('workout_routine_id')->constrained()->cascadeOnDelete();
            // Restricted, not cascading: deleting an exercise that a routine
            // still references should fail loudly rather than quietly empty
            // somebody's routine.
            $table->foreignUuid('exercise_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('position');
            $table->unsignedSmallInteger('target_sets')->nullable();
            $table->unsignedSmallInteger('target_reps')->nullable();
            // Integer grams, metres and seconds throughout - the same call as
            // Budget's integer cents. Nothing stores a float.
            $table->unsignedInteger('target_weight_grams')->nullable();
            $table->unsignedInteger('target_distance_metres')->nullable();
            $table->unsignedInteger('target_duration_seconds')->nullable();
            $table->unsignedSmallInteger('rest_seconds')->nullable();
            $table->timestamps();

            $table->index(['workout_routine_id', 'position'], 'workout_routine_items_order_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workout_routine_items');
    }
};
