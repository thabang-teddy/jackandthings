<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * What kind of training an exercise is. Four cases rather than a free-text
 * field because the library's filters, and the "did I train everything this
 * week" view, both group by this - and because a typo in a free-text category
 * would silently split a group in two.
 */
enum ExerciseCategory: string
{
    case Strength = 'strength';
    case Cardio = 'cardio';
    case Flexibility = 'flexibility';
    case Mobility = 'mobility';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $category): string => $category->value, self::cases());
    }

    public function label(): string
    {
        return match ($this) {
            self::Strength => 'Strength',
            self::Cardio => 'Cardio',
            self::Flexibility => 'Flexibility',
            self::Mobility => 'Mobility',
        };
    }
}
