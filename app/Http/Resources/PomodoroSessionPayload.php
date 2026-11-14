<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\PomodoroSession;

/** The wire shape of a logged interval; see PomodoroPresetPayload for why. */
final class PomodoroSessionPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(PomodoroSession $session): array
    {
        return [
            'id' => $session->id,
            'pomodoro_preset_id' => $session->pomodoro_preset_id,
            'preset_name' => $session->preset_name,
            'tag' => $session->tag,
            'phase' => $session->phase->value,
            'started_at' => $session->started_at->toIso8601String(),
            'ended_at' => $session->ended_at->toIso8601String(),
            'duration_seconds' => $session->duration_seconds,
            'completed' => $session->completed,
            'source' => $session->source,
        ];
    }

    /**
     * @param  iterable<PomodoroSession>  $sessions
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
