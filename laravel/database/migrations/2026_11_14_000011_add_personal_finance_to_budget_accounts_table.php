<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Accounts stop being a name and become a wallet (issue #5).
 *
 * `kind` labels the source; `opening_balance_cents` is the only balance this
 * application stores, and it is a starting figure rather than a running one -
 * the ledger still derives the current balance. `archived_at` lets an account
 * be retired without deleting the transactions that reference it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budget_accounts', function (Blueprint $table) {
            $table->string('kind', 20)->default('cash')->after('name');
            $table->unsignedBigInteger('opening_balance_cents')->default(0)->after('kind');
            $table->timestamp('archived_at')->nullable()->after('opening_balance_cents');

            $table->index(['user_id', 'archived_at'], 'budget_accounts_user_archived_index');
        });
    }

    public function down(): void
    {
        Schema::table('budget_accounts', function (Blueprint $table) {
            $table->dropIndex('budget_accounts_user_archived_index');
            $table->dropColumn(['kind', 'opening_balance_cents', 'archived_at']);
        });
    }
};
