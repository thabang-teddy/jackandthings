<?php

declare(strict_types=1);

use App\Enums\PomodoroAmbience;
use App\Enums\PomodoroSound;
use App\Enums\PomodoroTicking;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Grows a preset from "focus + break minutes" into the full Pomodoro shape
 * issue #3 describes: a long break on a cycle, auto-start choices, a category
 * tag, which sounds to play, and strict mode with its own blocklist.
 *
 * Every column has a default that reproduces the previous behaviour, so rows
 * written before this migration keep working: a 15-minute long break every
 * fourth cycle, breaks auto-starting (which is what the old roll-over did),
 * focus not auto-starting, and no sound.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pomodoro_presets', function (Blueprint $table) {
            // break_minutes was created NOT NULL with no default, back when
            // the request required it. It is optional now, so the column
            // needs a default of its own or an omitted break would fail the
            // insert rather than fall back to five minutes.
            $table->unsignedSmallInteger('break_minutes')->default(5)->change();

            $table->unsignedSmallInteger('long_break_minutes')->default(15)->after('break_minutes');
            $table->unsignedTinyInteger('cycles_before_long_break')->default(4)->after('long_break_minutes');

            $table->boolean('auto_start_breaks')->default(true)->after('cycles_before_long_break');
            $table->boolean('auto_start_focus')->default(false)->after('auto_start_breaks');

            $table->string('tag', 40)->nullable()->after('auto_start_focus');

            $table->string('alarm_sound', 20)->default(PomodoroSound::Chime->value)->after('tag');
            $table->string('ticking_sound', 20)->default(PomodoroTicking::None->value)->after('alarm_sound');
            $table->string('ambience', 20)->default(PomodoroAmbience::None->value)->after('ticking_sound');

            $table->boolean('strict_mode')->default(false)->after('ambience');
            // Host patterns the add-on blocks while a focus interval runs. Kept
            // on the preset rather than in its own table so "strict mode for
            // Deep work" can block a different set from another preset.
            $table->json('blocked_sites')->nullable()->after('strict_mode');
        });
    }

    public function down(): void
    {
        Schema::table('pomodoro_presets', function (Blueprint $table) {
            $table->dropColumn([
                'long_break_minutes',
                'cycles_before_long_break',
                'auto_start_breaks',
                'auto_start_focus',
                'tag',
                'alarm_sound',
                'ticking_sound',
                'ambience',
                'strict_mode',
                'blocked_sites',
            ]);
        });
    }
};
