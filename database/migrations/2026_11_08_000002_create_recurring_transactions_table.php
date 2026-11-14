<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recurring_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('account_id')->constrained('budget_accounts')->cascadeOnDelete();
            $table->string('type', 20);
            $table->unsignedBigInteger('amount_cents');
            $table->string('description', 255)->nullable();
            $table->string('cadence', 10);
            $table->date('next_run_at');
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['user_id', 'next_run_at'], 'recurring_transactions_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recurring_transactions');
    }
};
