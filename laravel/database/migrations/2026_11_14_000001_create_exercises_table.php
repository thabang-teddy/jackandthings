<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The exercise library.
 *
 * This is the one table in the application whose rows are not all owned by a
 * user: a null `user_id` is a seeded catalog row that everybody can read and
 * nobody can edit. ExercisePolicy enforces that split - view passes for a
 * global row or your own, update and delete only for your own.
 *
 * No images or video. "Form demonstrations" ship as written instructions plus
 * a list of cues, for the same reason the Pomodoro sounds are synthesised
 * rather than sampled: bundling demo media means redistributing somebody
 * else's recordings.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exercises', function (Blueprint $table) {
            $table->uuid('id')->primary();
            // Null for the seeded catalog; set for a user's own exercise.
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('slug', 140);
            $table->string('category', 20);
            $table->string('primary_muscle', 60)->nullable();
            $table->string('equipment', 60)->nullable();
            $table->string('metric', 20);
            $table->text('instructions')->nullable();
            // Short form reminders, one per line item, rendered as a list.
            $table->json('cues')->nullable();
            $table->timestamps();

            // Stops a user creating the same exercise twice. Note that on
            // SQLite and MySQL two NULLs are distinct, so this does not
            // constrain the seeded rows - ExerciseLibrarySeeder keys on the
            // slug itself so re-seeding updates rather than duplicates.
            $table->unique(['user_id', 'slug']);
            // The library list: a user's own rows plus the catalog, by name.
            $table->index(['user_id', 'category'], 'exercises_user_category_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exercises');
    }
};
