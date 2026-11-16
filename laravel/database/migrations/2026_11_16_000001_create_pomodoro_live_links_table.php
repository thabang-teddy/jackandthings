<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The live link: the Pomodoro state that is running right now, stored so the
 * website and the phone can see each other's timer and stay in sync.
 *
 * A running timer is still ephemeral by design - this row exists only while a
 * session is active and is deleted the moment it stops. It is the user's own
 * row: one per user, replaced each time the timer changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pomodoro_live_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            /**
             * The timer state the owning client last wrote: preset, phase,
             * seconds left, running flag and so on. The other client reads it
             * to draw the same clock, so it must be complete enough to render
             * without another round trip.
             */
            $table->json('state');

            $table->timestamps();

            $table->index(['user_id', 'updated_at'], 'pomodoro_live_links_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pomodoro_live_links');
    }
};
