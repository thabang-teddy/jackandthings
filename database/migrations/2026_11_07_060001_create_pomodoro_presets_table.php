<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pomodoro_presets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->unsignedSmallInteger('focus_minutes');
            $table->unsignedSmallInteger('break_minutes');
            $table->timestamps();

            $table->index(['user_id', 'created_at'], 'pomodoro_presets_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pomodoro_presets');
    }
};
