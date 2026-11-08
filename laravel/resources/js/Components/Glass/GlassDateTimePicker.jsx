import { useEffect, useRef, useState } from 'react';
import { CalendarIcon } from '@/Components/Glass/icons';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

const pad = (value) => String(value).padStart(2, '0');

/** Parse a "YYYY-MM-DDTHH:mm" value into a Date, or now when empty/invalid. */
function parseValue(value) {
    if (value) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return new Date();
}

function toValue(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDisplay(value) {
    if (!value) {
        return 'Now';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Now';
    }
    return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Monday-first day cells (nulls pad the leading blanks) for a given month. */
function monthGrid(year, month) {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array(offset).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
        cells.push(day);
    }
    return cells;
}

/**
 * A themed date + time picker that emits the same "YYYY-MM-DDTHH:mm" string a
 * native datetime-local would, so callers and server validation are unchanged.
 */
export default function GlassDateTimePicker({ id, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState(() => parseValue(value));
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const onClickOutside = (event) => {
            if (!containerRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open]);

    const selected = value ? parseValue(value) : null;
    const current = parseValue(value);

    const commit = (next) => onChange(toValue(next));

    const pickDay = (day) => {
        const next = new Date(current);
        next.setFullYear(view.getFullYear(), view.getMonth(), day);
        commit(next);
    };

    const setTime = (hours, minutes) => {
        const next = new Date(current);
        next.setHours(hours, minutes);
        commit(next);
    };

    const shiftMonth = (delta) => {
        setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
    };

    const cells = monthGrid(view.getFullYear(), view.getMonth());
    const isSelected = (day) =>
        selected &&
        selected.getFullYear() === view.getFullYear() &&
        selected.getMonth() === view.getMonth() &&
        selected.getDate() === day;

    return (
        <div className="relative" ref={containerRef}>
            <button
                id={id}
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-left text-sm text-[var(--ink)] transition hover:border-[var(--accent)]"
            >
                <span>{formatDisplay(value)}</span>
                <CalendarIcon size={15} className="text-[var(--muted)]" />
            </button>

            {open && (
                <div className="absolute z-20 mt-2 w-72 rounded-2xl border border-[var(--card-border)] bg-[var(--bg)] p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => shiftMonth(-1)}
                            className="h-7 w-7 rounded-full text-[var(--muted)] hover:bg-[var(--card-bg)] hover:text-[var(--ink)]"
                            aria-label="Previous month"
                        >
                            ‹
                        </button>
                        <span className="text-sm font-semibold">
                            {MONTHS[view.getMonth()]} {view.getFullYear()}
                        </span>
                        <button
                            type="button"
                            onClick={() => shiftMonth(1)}
                            className="h-7 w-7 rounded-full text-[var(--muted)] hover:bg-[var(--card-bg)] hover:text-[var(--ink)]"
                            aria-label="Next month"
                        >
                            ›
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--muted)]">
                        {WEEKDAYS.map((weekday) => (
                            <div key={weekday}>{weekday}</div>
                        ))}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                        {cells.map((day, index) =>
                            day === null ? (
                                <div key={`pad-${index}`} />
                            ) : (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => pickDay(day)}
                                    className={
                                        'h-8 rounded-lg text-xs transition ' +
                                        (isSelected(day)
                                            ? 'bg-[var(--accent)] font-bold text-[var(--accent-ink)]'
                                            : 'text-[var(--ink)] hover:bg-[var(--card-bg)]')
                                    }
                                >
                                    {day}
                                </button>
                            ),
                        )}
                    </div>

                    <div className="mt-3 flex items-center gap-2 border-t border-[var(--card-border)] pt-3">
                        <span className="text-xs text-[var(--muted)]">
                            Time
                        </span>
                        <select
                            value={current.getHours()}
                            onChange={(e) =>
                                setTime(
                                    Number(e.target.value),
                                    current.getMinutes(),
                                )
                            }
                            className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1 text-sm text-[var(--ink)]"
                            aria-label="Hour"
                        >
                            {Array.from({ length: 24 }, (_, h) => (
                                <option key={h} value={h}>
                                    {pad(h)}
                                </option>
                            ))}
                        </select>
                        <span className="text-[var(--muted)]">:</span>
                        <select
                            value={current.getMinutes()}
                            onChange={(e) =>
                                setTime(
                                    current.getHours(),
                                    Number(e.target.value),
                                )
                            }
                            className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1 text-sm text-[var(--ink)]"
                            aria-label="Minute"
                        >
                            {Array.from({ length: 60 }, (_, m) => (
                                <option key={m} value={m}>
                                    {pad(m)}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="ml-auto text-xs font-semibold text-[var(--accent)] hover:underline"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
