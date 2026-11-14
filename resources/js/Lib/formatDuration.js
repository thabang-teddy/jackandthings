/**
 * Durations as people say them, for the Pomodoro analytics.
 *
 * The server sends seconds; nobody reads "7380 seconds" as two hours. These
 * are display-only helpers with no data derivation of their own.
 */

/** "2h 3m", "45m", "0m" - the compact form used on stat tiles. */
export function formatHoursMinutes(totalSeconds) {
    const seconds = Math.max(Math.round(totalSeconds ?? 0), 0);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);

    if (hours === 0) {
        return `${minutes}m`;
    }

    // 59.6 minutes rounding to 60 would print "2h 60m"; carry it instead.
    if (minutes === 60) {
        return `${hours + 1}h 0m`;
    }

    return `${hours}h ${minutes}m`;
}

/** Decimal hours, for an axis label where "2h 3m" is too wide. */
export function formatHours(totalSeconds) {
    const hours = Math.max(totalSeconds ?? 0, 0) / 3600;

    return hours >= 10 ? hours.toFixed(0) : hours.toFixed(1);
}

/** "14:00", from the hour index the analytics bucket by. */
export function formatHourOfDay(hour) {
    if (hour === null || hour === undefined) {
        return null;
    }

    return `${String(hour).padStart(2, '0')}:00`;
}

/** "09:00–12:00", for naming the productive stretch around a peak hour. */
export function formatHourRange(hour, span = 1) {
    if (hour === null || hour === undefined) {
        return null;
    }

    const end = (hour + span) % 24;

    return `${formatHourOfDay(hour)}–${formatHourOfDay(end)}`;
}
