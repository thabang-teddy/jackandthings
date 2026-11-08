<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pomodoro_presets', function (Blueprint $table) {
            $table->boolean('is_default')->default(false)->after('break_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('pomodoro_presets', function (Blueprint $table) {
            $table->dropColumn('is_default');
        });
    }
};
