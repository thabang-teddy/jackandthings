<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Background sound held under a focus interval. These are generated, not
 * sampled: rain and cafe are shaped noise, lo-fi is a synthesised chord loop
 * over vinyl crackle. That keeps the feature free of licensed recordings -
 * the issue asked for "rain, cafe sounds, lo-fi beats" and this is the
 * version of that which can actually ship in the repository.
 */
enum PomodoroAmbience: string
{
    case None = 'none';
    case Rain = 'rain';
    case Cafe = 'cafe';
    case WhiteNoise = 'white_noise';
    case BrownNoise = 'brown_noise';
    case LoFi = 'lofi';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $ambience): string => $ambience->value, self::cases());
    }
}
