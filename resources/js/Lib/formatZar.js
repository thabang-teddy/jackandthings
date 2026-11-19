const formatter = new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
});

/**
 * Amounts are stored and sent as integer cents; formatting happens here so no
 * float arithmetic touches money.
 *
 * @param {number} cents
 * @returns {string}
 */
export function formatZar(cents) {
    return formatter.format((cents ?? 0) / 100);
}
