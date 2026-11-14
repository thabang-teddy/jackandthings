<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Recurring rows become bills that can warn before they fall due (issue #5).
 *
 * `remind_days_before` is nullable on purpose: a salary is a recurring deposit
 * with nothing to warn about, while rent is a bill. A non-null value means
 * "surface this as due once it is within N days", and the clients poll that
 * state - the server still sends nothing.
 *
 * `category_id` lets a recurring bill feed the same category rollups as a
 * one-off transaction.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recurring_transactions', function (Blueprint $table) {
            $table->foreignUuid('category_id')
                ->nullable()
                ->after('account_id')
                ->constrained('budget_categories')
                ->nullOnDelete();
            $table->unsignedTinyInteger('remind_days_before')->nullable()->after('active');
        });
    }

    public function down(): void
    {
        Schema::table('recurring_transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('category_id');
            $table->dropColumn('remind_days_before');
        });
    }
};
