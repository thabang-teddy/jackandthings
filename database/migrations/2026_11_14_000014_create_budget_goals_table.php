<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A savings goal or sinking fund (issue #5).
 *
 * A goal is a virtual jar, not a bank account: `saved_cents` is a running
 * total the user keeps up to date, and moving money into it does not move
 * money between accounts. Naming an account is optional and only says where
 * the money is meant to come from; deleting that account leaves the goal
 * standing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_goals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->unsignedBigInteger('target_cents');
            $table->unsignedBigInteger('saved_cents')->default(0);
            $table->foreignUuid('account_id')->nullable()->constrained('budget_accounts')->nullOnDelete();
            $table->date('target_date')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'archived_at'], 'budget_goals_user_archived_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_goals');
    }
};
