<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\PomodoroLiveLink;

/**
 * The live link on the wire: the Pomodoro state that is running right now,
 * stored so the website and the phone can see each other's timer.
 *
 * `state` is the timer state the owning client last wrote - preset, phase,
 * seconds left, running flag and so on. It is handed across verbatim so the
 * other client can draw the same clock without another round trip.
 */
final class PomodoroLiveLinkPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(PomodoroLiveLink $liveLink): array
    {
        return [
            'id' => $liveLink->id,
            'state' => $liveLink->state,
            'updated_at' => $liveLink->updated_at?->toIso8601String(),
        ];
    }
}
