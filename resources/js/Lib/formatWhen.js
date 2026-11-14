/**
 * Timestamps cross the api/v1 boundary as absolute ISO-8601 instants and are
 * stored in UTC; each client renders them in the viewer's own zone. Formatting
 * server-side with Carbon printed the app timezone (UTC) instead, which showed
 * every logged time two hours behind the clock the entry was made on.
 *
 * The Android client's formatLoggedAt uses the same pattern, so both surfaces
 * read the same.
 *
 * @param {string|null|undefined} value An ISO-8601 instant.
 * @returns {string} The instant in the viewer's zone, or '' when there is none.
 */
const formatter = new Intl.DateTimeFormat('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

export function formatWhen(value) {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    // Anything unparseable is shown as sent rather than swallowed, so a bad
    // payload is visible instead of silently rendering "Invalid Date".
    return Number.isNaN(date.getTime())
        ? String(value)
        : formatter.format(date);
}
