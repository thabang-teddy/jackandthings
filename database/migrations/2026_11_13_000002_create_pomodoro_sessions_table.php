<?php

declare(strict_types=1);

use App\Enums\PomodoroPhase;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A log of finished intervals, which is what the daily and weekly analytics in
 * issue #3 are computed from.
 *
 * This reverses an earlier decision recorded in docs/ARCHITECTURE.md and
 * docs/DATABASE.md, that no Pomodoro session history is stored. The narrower
 * part of that decision still holds: a *running* timer is still never
 * persisted and still only lives as long as the client that owns it. Only a
 * finished (or abandoned) interval is written here, once, by whichever client
 * saw it end - which is also why `source` exists.
 *
 * `preset_name` is denormalised on purpose: deleting a preset must not rewrite
 * history, so the row keeps the name it ran under while `pomodoro_preset_id`
 * goes null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pomodoro_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('pomodoro_preset_id')
                ->nullable()
                ->constrained('pomodoro_presets')
                ->nullOnDelete();

            $table->string('preset_name', 60);
            $table->string('tag', 40)->nullable();
            $table->string('phase', 20)->default(PomodoroPhase::Focus->value);

            $table->timestamp('started_at');
            $table->timestamp('ended_at');
            $table->unsignedInteger('duration_seconds');

            // False when the interval was stopped or skipped early. Both are
            // kept: "started six, finished four" is the useful signal, and
            // throwing the short ones away would hide it.
            $table->boolean('completed')->default(true);
            $table->string('source', 20)->nullable();

            $table->timestamps();

            $table->index(['user_id', 'started_at'], 'pomodoro_sessions_user_index');
            $table->index(['user_id', 'phase', 'started_at'], 'pomodoro_sessions_phase_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pomodoro_sessions');
    }
};
