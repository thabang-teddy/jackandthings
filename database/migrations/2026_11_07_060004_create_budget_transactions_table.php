<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('account_id')->constrained('budget_accounts')->cascadeOnDelete();
            $table->string('type', 20);
            $table->unsignedBigInteger('amount_cents');

            // A past transfer keeps its history even if the counterpart account is
            // later deleted, so this side is nulled rather than cascaded.
            $table->foreignUuid('related_account_id')->nullable()->constrained('budget_accounts')->nullOnDelete();
            $table->uuid('transfer_group_id')->nullable();

            $table->string('description')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at'], 'budget_transactions_user_index');
            $table->index(['account_id', 'created_at'], 'budget_transactions_account_index');
            $table->index('transfer_group_id', 'budget_transactions_transfer_group_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_transactions');
    }
};
