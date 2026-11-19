<?php

declare(strict_types=1);

namespace App\Enums;

use Carbon\CarbonInterface;

enum RecurringCadence: string
{
    case Daily = 'daily';
    case Weekly = 'weekly';
    case Monthly = 'monthly';

    /**
     * The next run date after $date. Monthly uses no-overflow so the 31st of a
     * short month lands on the last day rather than skipping forward.
     */
    public function advance(CarbonInterface $date): CarbonInterface
    {
        return match ($this) {
            self::Daily => $date->copy()->addDay(),
            self::Weekly => $date->copy()->addWeek(),
            self::Monthly => $date->copy()->addMonthNoOverflow(),
        };
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(fn (self $cadence): string => $cadence->value, self::cases());
    }
}
