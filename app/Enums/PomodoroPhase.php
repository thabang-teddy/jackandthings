<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The three intervals a Pomodoro cycle moves through. Short and long breaks
 * are separate cases rather than one "break" with a length, because the
 * analytics in PomodoroAnalytics count focus time only and need to tell the
 * two apart, and because a preset carries a different duration for each.
 *
 * Clients send these values verbatim when they log a finished interval.
 */
enum PomodoroPhase: string
{
    case Focus = 'focus';
    case ShortBreak = 'short_break';
    case LongBreak = 'long_break';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $phase): string => $phase->value, self::cases());
    }

    public function isFocus(): bool
    {
        return $this === self::Focus;
    }

    public function label(): string
    {
        return match ($this) {
            self::Focus => 'Focus',
            self::ShortBreak => 'Short break',
            self::LongBreak => 'Long break',
        };
    }
}
