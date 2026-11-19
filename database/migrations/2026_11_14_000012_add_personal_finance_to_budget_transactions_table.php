<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A transaction gains the date it happened, a merchant and a category
 * (issue #5).
 *
 * `created_at` stays the immutable audit stamp; `occurred_on` is what the user
 * supplies and what every report and monthly limit groups by. Existing rows
 * are backfilled from the day they were written, which is the only date the
 * ledger had before now.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budget_transactions', function (Blueprint $table) {
            $table->date('occurred_on')->nullable()->after('type');
            $table->string('merchant', 120)->nullable()->after('occurred_on');

            // A deleted category leaves its transactions uncategorized rather
            // than deleting the money that was spent under it.
            $table->foreignUuid('category_id')
                ->nullable()
                ->after('merchant')
                ->constrained('budget_categories')
                ->nullOnDelete();

            $table->index(['user_id', 'occurred_on'], 'budget_transactions_user_occurred_index');
            $table->index(['category_id', 'occurred_on'], 'budget_transactions_category_occurred_index');
        });

        DB::table('budget_transactions')
            ->whereNull('occurred_on')
            ->update(['occurred_on' => DB::raw('date(created_at)')]);
    }

    public function down(): void
    {
        Schema::table('budget_transactions', function (Blueprint $table) {
            $table->dropIndex('budget_transactions_user_occurred_index');
            $table->dropIndex('budget_transactions_category_occurred_index');
            $table->dropConstrainedForeignId('category_id');
            $table->dropColumn(['occurred_on', 'merchant']);
        });
    }
};
