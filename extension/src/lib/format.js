/**
 * Amounts travel as integer cents and are only ever formatted for display, so
 * no floating-point arithmetic touches money. ZAR is fixed app-wide, matching
 * the server and the Android client.
 */
const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });

export function formatZar(cents) {
    return zar.format((Number(cents) || 0) / 100);
}

export function formatClock(totalSeconds) {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
    const seconds = String(safe % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

export function formatWhen(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('en-ZA', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Transfer rows must read source → destination whichever leg this is.
 *
 * The API sends the two account projections as names with the ids beside them
 * (`account`, `related_account`), so these are strings. The `?.name` fallback
 * keeps a row shaped the old way (an object) readable rather than '—'.
 */
const accountName = (value) => (typeof value === 'string' ? value : (value?.name ?? null));

export function transferFlow(transaction) {
    const own = accountName(transaction.account) ?? '—';
    const other = accountName(transaction.related_account);
    if (!other) return own;
    return transaction.type === 'transfer_in' ? `${other} → ${own}` : `${own} → ${other}`;
}

export const TYPE_LABELS = {
    deposit: 'Deposit',
    withdrawal: 'Withdrawal',
    transfer_in: 'Transfer in',
    transfer_out: 'Transfer out',
};

export const isCredit = (type) => type === 'deposit' || type === 'transfer_in';
