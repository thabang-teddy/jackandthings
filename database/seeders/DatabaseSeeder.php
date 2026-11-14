<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(AdminUserSeeder::class);

        // The exercise catalog is reference data, not demo data: it has no
        // owner, every environment needs it, and re-running it updates rather
        // than duplicates.
        $this->call(ExerciseLibrarySeeder::class);

        // Demo data is local-only; production seeding should stay empty.
        if (app()->environment('local')) {
            $this->call(DemoDataSeeder::class);
        }
    }
}
