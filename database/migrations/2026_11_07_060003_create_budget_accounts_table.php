<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->timestamps();

            $table->unique(['user_id', 'name'], 'budget_accounts_user_name_unique');
            $table->index(['user_id', 'created_at'], 'budget_accounts_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_accounts');
    }
};
