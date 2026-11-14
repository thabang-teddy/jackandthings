<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The optional once-a-second tick while a focus interval runs. Synthesised
 * client-side like PomodoroSound; see that enum for why nothing is bundled.
 */
enum PomodoroTicking: string
{
    case None = 'none';
    case Clock = 'clock';
    case Soft = 'soft';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $ticking): string => $ticking->value, self::cases());
    }
}
