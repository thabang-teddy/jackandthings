<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A receipt image attached to one transaction (issue #5).
 *
 * The file itself follows the progress-photo rules exactly: private disk only,
 * a random name with an extension derived from the validated mime type, and
 * reading it always goes back through an authorized route. `disk` sits beside
 * `path` so a later move to another disk orphans nothing.
 *
 * One receipt per transaction: deleting the transaction deletes the row, and
 * the service deletes the file before it does.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_receipts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('transaction_id')->constrained('budget_transactions')->cascadeOnDelete();
            $table->string('disk', 20);
            $table->string('path');
            $table->string('mime', 80);
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->timestamps();

            $table->unique('transaction_id', 'budget_receipts_transaction_unique');
            $table->index('user_id', 'budget_receipts_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_receipts');
    }
};
