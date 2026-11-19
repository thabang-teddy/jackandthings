<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Models\WorkoutRoutine;
use Illuminate\Support\Facades\DB;

/**
 * Saves a routine and its items as one unit.
 *
 * A routine without its items is not a half-saved routine, it is a broken one -
 * the UI would show an empty workout and the user would have to rebuild it. So
 * both go in one transaction, and an update replaces the item list outright
 * rather than trying to diff it.
 *
 * Replacing rather than diffing is a deliberate trade: it means the items get
 * new ids on every save, which nothing depends on (a logged set references the
 * *exercise*, never the routine item), and it means reordering, inserting and
 * removing all take the same path instead of three.
 *
 * Shared by the web controller and the API controller so the two cannot drift.
 */
class WorkoutRoutineWriter
{
    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>  $items
     */
    public function create(User $user, array $attributes, array $items): WorkoutRoutine
    {
        return DB::transaction(function () use ($user, $attributes, $items): WorkoutRoutine {
            $routine = $user->workoutRoutines()->create($attributes);
            $routine->items()->createMany($items);

            return $routine->load('items.exercise');
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>|null  $items  Null leaves the items alone.
     */
    public function update(WorkoutRoutine $routine, array $attributes, ?array $items): WorkoutRoutine
    {
        return DB::transaction(function () use ($routine, $attributes, $items): WorkoutRoutine {
            if ($attributes !== []) {
                $routine->update($attributes);
            }

            if ($items !== null) {
                $routine->items()->delete();
                $routine->items()->createMany($items);
            }

            return $routine->load('items.exercise');
        });
    }
}
