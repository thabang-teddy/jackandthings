/**
 * The Budget rules every surface has to agree on: how a spending cap is
 * classified, how far a goal has come, and what a `YYYY-MM` period means.
 *
 * This is the web copy. The others are `extension/src/lib/budgetRules.js` and
 * `android/.../budget/BudgetRules.kt`, and the authority is
 * `laravel/app/Support/BudgetRules.php`. The server sends a computed state with
 * its replies; this file exists so a badge drawn between replies - and every
 * read made offline - says the same thing without a round trip.
 *
 * Pure on purpose: integers only, no React, no Date, no locale. A user changing
 * their locale must never change whether a limit is "near".
 */

/** "Near" starts at 80% of the cap. */
export const NEAR_PERCENT = 80;

export const STATE_NONE = 'none';
export const STATE_UNDER = 'under';
export const STATE_NEAR = 'near';
export const STATE_OVER = 'over';

/** Cents in, one of the four states out. A missing cap is not "under". */
export function limitState(spentCents, limitCents) {
    if (!(limitCents > 0)) {
        return STATE_NONE;
    }

    if (spentCents > limitCents) {
        return STATE_OVER;
    }

    if (spentCents * 100 >= limitCents * NEAR_PERCENT) {
        return STATE_NEAR;
    }

    return STATE_UNDER;
}

/** Percentage of the cap used, deliberately not capped - 120% is worth seeing. */
export function limitPercent(spentCents, limitCents) {
    if (!(limitCents > 0)) {
        return 0;
    }

    return Math.trunc((spentCents * 100) / limitCents);
}

/** Capped at 100 for a progress bar; goalComplete is the separate answer. */
export function goalPercent(savedCents, targetCents) {
    if (!(targetCents > 0)) {
        return 0;
    }

    return Math.min(
        100,
        Math.trunc((Math.max(0, savedCents) * 100) / targetCents),
    );
}

export function goalComplete(savedCents, targetCents) {
    return targetCents > 0 && savedCents >= targetCents;
}

/** The `YYYY-MM` a `YYYY-MM-DD` date belongs to. */
export function monthOf(date) {
    return String(date ?? '').slice(0, 7);
}

/**
 * The inclusive first and last day of a period.
 *
 * @returns {{start: string, end: string}}
 */
export function monthBounds(period) {
    const [year, month] = String(period).split('-').map(Number);

    return {
        start: `${pad(year, 4)}-${pad(month, 2)}-01`,
        end: `${pad(year, 4)}-${pad(month, 2)}-${pad(daysInMonth(year, month), 2)}`,
    };
}

/** Move a `YYYY-MM` period by whole months, across year boundaries. */
export function shiftPeriod(period, delta) {
    const [year, month] = String(period).split('-').map(Number);
    const index = year * 12 + (month - 1) + delta;

    return `${pad(Math.trunc(index / 12), 4)}-${pad((index % 12) + 1, 2)}`;
}

function pad(value, width) {
    return String(value).padStart(width, '0');
}

function daysInMonth(year, month) {
    if (month === 2) {
        return isLeapYear(year) ? 29 : 28;
    }

    if (month === 4 || month === 6 || month === 9 || month === 11) {
        return 30;
    }

    return 31;
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
