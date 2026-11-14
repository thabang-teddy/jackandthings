<?php

declare(strict_types=1);

namespace App\Support;

/**
 * The server's copy of the small rules every Budget client must agree on.
 *
 * The same three rules are written three more times on purpose:
 * `laravel/resources/js/Lib/budgetRules.js`,
 * `extension/src/lib/budgetRules.js` and
 * `android/.../budget/BudgetRules.kt`. Each has a header saying so. The server
 * is the authority where a reply carries a computed state; the clients need
 * the same answer locally so a limit badge does not flicker between surfaces.
 *
 * Everything here is integer arithmetic on cents and `YYYY-MM` strings. No
 * formatting, no locale, no Date object in a comparison - a locale change
 * must never alter whether a limit is "near".
 */
final class BudgetRules
{
    /** "Near" starts at 80% of the cap. */
    public const NEAR_PERCENT = 80;

    public const STATE_NONE = 'none';

    public const STATE_UNDER = 'under';

    public const STATE_NEAR = 'near';

    public const STATE_OVER = 'over';

    public static function limitState(int $spentCents, int $limitCents): string
    {
        if ($limitCents <= 0) {
            return self::STATE_NONE;
        }

        if ($spentCents > $limitCents) {
            return self::STATE_OVER;
        }

        if ($spentCents * 100 >= $limitCents * self::NEAR_PERCENT) {
            return self::STATE_NEAR;
        }

        return self::STATE_UNDER;
    }

    /** Percentage of the cap used, not capped - 120% is a useful number to show. */
    public static function limitPercent(int $spentCents, int $limitCents): int
    {
        if ($limitCents <= 0) {
            return 0;
        }

        return intdiv($spentCents * 100, $limitCents);
    }

    /** Capped at 100 for a progress bar; [goalComplete] is the separate answer. */
    public static function goalPercent(int $savedCents, int $targetCents): int
    {
        if ($targetCents <= 0) {
            return 0;
        }

        return min(100, intdiv(max(0, $savedCents) * 100, $targetCents));
    }

    public static function goalComplete(int $savedCents, int $targetCents): bool
    {
        return $targetCents > 0 && $savedCents >= $targetCents;
    }

    /** The `YYYY-MM` a `YYYY-MM-DD` date belongs to. */
    public static function monthOf(string $date): string
    {
        return substr($date, 0, 7);
    }

    /**
     * The inclusive first and last day of a period, as strings.
     *
     * @return array{start: string, end: string}
     */
    public static function monthBounds(string $period): array
    {
        [$year, $month] = array_map('intval', explode('-', $period));
        $days = self::daysInMonth($year, $month);

        return [
            'start' => sprintf('%04d-%02d-01', $year, $month),
            'end' => sprintf('%04d-%02d-%02d', $year, $month, $days),
        ];
    }

    /** Move a `YYYY-MM` period by whole months, across year boundaries. */
    public static function shiftPeriod(string $period, int $delta): string
    {
        [$year, $month] = array_map('intval', explode('-', $period));
        $index = $year * 12 + ($month - 1) + $delta;
        $newYear = intdiv($index, 12);
        $newMonth = $index % 12 + 1;

        return sprintf('%04d-%02d', $newYear, $newMonth);
    }

    private static function daysInMonth(int $year, int $month): int
    {
        return match ($month) {
            2 => self::isLeapYear($year) ? 29 : 28,
            4, 6, 9, 11 => 30,
            default => 31,
        };
    }

    private static function isLeapYear(int $year): bool
    {
        return ($year % 4 === 0 && $year % 100 !== 0) || $year % 400 === 0;
    }
}
