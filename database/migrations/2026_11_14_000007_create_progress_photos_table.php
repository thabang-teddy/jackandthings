<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Progress photos - the first file upload in this project.
 *
 * The row records where the file is; the file itself goes on the private
 * `local` disk (storage/app/private), never the public one, and is served only
 * through an authorized controller action. There is no public URL and no
 * storage:link involved. See docs/SECURITY.md "Uploads".
 *
 * `disk` is stored alongside the path so moving to S3 later does not orphan
 * the rows written before the move.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('progress_photos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Optionally pinned to the day's measurements, so the two can be
            // shown together. Nulled, not cascaded: deleting a weigh-in should
            // not silently delete the photo taken that day.
            $table->foreignUuid('body_metric_id')->nullable()->constrained()->nullOnDelete();
            $table->string('disk', 20);
            $table->string('path');
            $table->string('mime', 60);
            $table->unsignedInteger('size_bytes');
            $table->date('taken_on');
            $table->string('caption', 120)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'taken_on'], 'progress_photos_user_taken_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('progress_photos');
    }
};
