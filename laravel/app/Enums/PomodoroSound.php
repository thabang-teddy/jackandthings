<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The end-of-interval alarm. Every client synthesises these rather than
 * playing a bundled recording - Web Audio on the web and in the add-on,
 * AudioTrack on Android - so no audio assets ship with the project and no
 * third-party recording is redistributed. The server only stores which one a
 * preset asked for.
 */
enum PomodoroSound: string
{
    case None = 'none';
    case Chime = 'chime';
    case Bell = 'bell';
    case Digital = 'digital';
    case Marimba = 'marimba';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $sound): string => $sound->value, self::cases());
    }
}
