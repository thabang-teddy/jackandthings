<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Body weight, body fat and tape measurements, one row per day.
 *
 * Integers only, as everywhere else in this project: grams for weight,
 * permille for body fat (so 17.5% is 175 and nothing rounds), millimetres for
 * the tape. The measurements themselves are a json map rather than five
 * columns because which ones a user bothers with varies, and adding a sixth
 * site should not be a migration.
 *
 * This is health data about a person. docs/SECURITY.md "Privacy" covers it
 * alongside the progress photos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('body_metrics', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('measured_on');
            $table->unsignedInteger('weight_grams')->nullable();
            $table->unsignedSmallInteger('body_fat_permille')->nullable();
            // { chest, waist, hips, arm, thigh, calf, neck } in millimetres,
            // every key optional.
            $table->json('measurements')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            // One reading per day: logging again replaces the day's figures
            // rather than stacking two rows the charts would both plot.
            $table->unique(['user_id', 'measured_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('body_metrics');
    }
};
