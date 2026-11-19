<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workout_presets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('activity', 100);
            $table->timestamps();

            $table->index(['user_id', 'created_at'], 'workout_presets_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workout_presets');
    }
};
