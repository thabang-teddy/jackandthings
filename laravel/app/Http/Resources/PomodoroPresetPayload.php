<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\PomodoroPreset;

/**
 * The one shape a preset takes on the wire.
 *
 * docs/ARCHITECTURE.md makes api/v1 the single contract behind all three
 * clients, so the web page, the Android app and the add-on must see the same
 * field names for the same preset. Before issue #3 a preset had four fields
 * and each controller hand-rolled its own array; with fourteen, two
 * hand-rolled copies would drift. This is the one place that mapping lives.
 */
final class PomodoroPresetPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(PomodoroPreset $preset): array
    {
        return [
            'id' => $preset->id,
            'name' => $preset->name,

            'focus_minutes' => $preset->focus_minutes,
            'break_minutes' => $preset->break_minutes,
            'long_break_minutes' => $preset->long_break_minutes,
            'cycles_before_long_break' => $preset->cycles_before_long_break,

            'auto_start_breaks' => $preset->auto_start_breaks,
            'auto_start_focus' => $preset->auto_start_focus,

            'tag' => $preset->tag,

            'alarm_sound' => $preset->alarm_sound->value,
            'ticking_sound' => $preset->ticking_sound->value,
            'ambience' => $preset->ambience->value,

            'strict_mode' => $preset->strict_mode,
            'blocked_sites' => $preset->blockedSites(),

            'is_default' => $preset->is_default,
        ];
    }

    /**
     * @param  iterable<PomodoroPreset>  $presets
     * @return array<int, array<string, mixed>>
     */
    public static function collection(iterable $presets): array
    {
        $payload = [];
        foreach ($presets as $preset) {
            $payload[] = self::from($preset);
        }

        return $payload;
    }
}
