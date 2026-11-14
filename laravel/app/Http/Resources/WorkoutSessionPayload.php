<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\WorkoutSession;
use App\Models\WorkoutSet;

/**
 * A workout, with its sets when they have been loaded.
 *
 * `routine_name` comes off the session's own denormalised column rather than
 * the related routine, so the history still reads correctly after the routine
 * has been renamed or deleted.
 *
 * The totals are computed here rather than by each client, so the three
 * surfaces cannot disagree about what a session's volume was.
 */
final class WorkoutSessionPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(WorkoutSession $session): array
    {
        $sets = $session->relationLoaded('sets') ? $session->sets : collect();

        return [
            'id' => $session->id,
            'workout_routine_id' => $session->workout_routine_id,
            'routine_name' => $session->routine_name,
            'started_at' => $session->started_at?->toIso8601String(),
            'finished_at' => $session->finished_at?->toIso8601String(),
            'is_open' => $session->isOpen(),
            'notes' => $session->notes,
            'duration_seconds' => $session->finished_at === null
                ? null
                : $session->finished_at->diffInSeconds($session->started_at, true),
            'set_count' => $sets->count(),
            'volume_grams' => (int) $sets
                ->reject(fn (WorkoutSet $set): bool => $set->is_warmup)
                ->sum(fn (WorkoutSet $set): int => $set->volumeGrams()),
            'sets' => WorkoutSetPayload::collection($sets),
        ];
    }

    /**
     * @param  iterable<WorkoutSession>  $sessions
     * @return array<int, array<string, mixed>>
     */
    public static function collection(iterable $sessions): array
    {
        $payload = [];
        foreach ($sessions as $session) {
            $payload[] = self::from($session);
        }

        return $payload;
    }
}
