<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Spending buckets, per user (issue #5).
 *
 * The issue asks for custom categories, and the cheapest honest version is a
 * per-user table seeded with its own five examples on first use. A global enum
 * would be smaller but would make "custom" untrue; a shared catalog would let
 * one user rename a bucket for everybody.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 40);
            $table->string('kind', 10)->default('expense');
            $table->timestamps();

            // Two buckets with the same name in one user's list would make a
            // report ambiguous, so the pair is unique.
            $table->unique(['user_id', 'name'], 'budget_categories_user_name_unique');
            $table->index(['user_id', 'kind'], 'budget_categories_user_kind_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_categories');
    }
};
