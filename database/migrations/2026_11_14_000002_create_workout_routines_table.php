<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A saved workout template - "Push day", "5K prep". The exercises it contains,
 * and their targets, live in workout_routine_items.
 *
 * This is deliberately a new table rather than a widening of workout_presets.
 * A preset prefills the one-line "I did a thing" log and the home page's quick
 * log popup; a routine is an ordered list of exercises with targets. Merging
 * them would have made the quick log carry fields it has no use for.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workout_routines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at'], 'workout_routines_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workout_routines');
    }
};
