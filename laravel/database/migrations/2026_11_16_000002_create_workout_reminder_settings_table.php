<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Workout reminder settings: a target to hit at selected times, replacing
 * the old "nothing logged this hour" nudge. A user sets a target count and
 * activity (e.g. 40 push-ups), a time window (e.g. 5am to 12pm), and the
 * reminder fires at each selected hour inside that window until the target
 * is met.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workout_reminder_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            /** How many of the activity the user wants to hit. */
            $table->unsignedInteger('target_count');

            /** The activity that counts toward the target, or null for any. */
            $table->string('activity', 100)->nullable();

            /** The window opens at this time each day. */
            $table->time('start_time');

            /** The window closes at this time each day. */
            $table->time('end_time');

            /** The hours (0-23) inside the window at which the reminder checks. */
            $table->json('check_times');

            /** Whether the reminder is active. */
            $table->boolean('active')->default(true);

            $table->timestamps();

            $table->index(['user_id', 'active'], 'workout_reminder_settings_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workout_reminder_settings');
    }
};
