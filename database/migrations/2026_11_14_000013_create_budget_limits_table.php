<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A monthly spending cap for one category (issue #5).
 *
 * The period is stored as `YYYY-MM` rather than a date so the same month
 * cannot be represented two ways. One cap per category per month: raising a
 * limit edits the row rather than adding a second cap.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_limits', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('category_id')->constrained('budget_categories')->cascadeOnDelete();
            $table->string('period', 7);
            $table->unsignedBigInteger('limit_cents');
            $table->timestamps();

            $table->unique(['user_id', 'category_id', 'period'], 'budget_limits_user_category_period_unique');
            $table->index(['user_id', 'period'], 'budget_limits_user_period_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_limits');
    }
};
