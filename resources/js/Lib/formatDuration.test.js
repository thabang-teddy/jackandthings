import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    formatHourOfDay,
    formatHourRange,
    formatHours,
    formatHoursMinutes,
} from './formatDuration.js';

/**
 * How the focus figures are written out.
 *
 * The rounding carry is the case worth having: minutes are rounded, so a
 * total a few seconds short of the hour rounds to 60 and would print
 * "2h 60m" without the carry. It is the kind of thing that only ever appears
 * in a screenshot somebody sends you.
 */

describe('formatHoursMinutes', () => {
    test('under an hour is minutes alone', () => {
        assert.equal(formatHoursMinutes(0), '0m');
        assert.equal(formatHoursMinutes(60), '1m');
        assert.equal(formatHoursMinutes(45 * 60), '45m');
    });

    test('an hour and over carries both parts', () => {
        assert.equal(formatHoursMinutes(3600), '1h 0m');
        assert.equal(formatHoursMinutes(7380), '2h 3m');
    });

    test('minutes rounding up to sixty roll into the hour', () => {
        // 1h 59m 40s rounds to 60 minutes; "1h 60m" would be wrong.
        assert.equal(formatHoursMinutes(3600 + 59 * 60 + 40), '2h 0m');
    });

    test('negative and missing totals read as nothing rather than as a minus', () => {
        assert.equal(formatHoursMinutes(-500), '0m');
        assert.equal(formatHoursMinutes(null), '0m');
        assert.equal(formatHoursMinutes(undefined), '0m');
    });
});

describe('formatHours', () => {
    test('one decimal place below ten hours, none above', () => {
        assert.equal(formatHours(5400), '1.5');
        assert.equal(formatHours(36000), '10');
    });

    test('a negative total is floored at zero', () => {
        assert.equal(formatHours(-3600), '0.0');
    });
});

describe('formatHourOfDay', () => {
    test('hours are zero-padded to a clock', () => {
        assert.equal(formatHourOfDay(0), '00:00');
        assert.equal(formatHourOfDay(9), '09:00');
        assert.equal(formatHourOfDay(14), '14:00');
    });

    test('no hour at all is null, not "00:00"', () => {
        // The analytics send null when nothing has been logged, and printing
        // midnight would read as a real answer.
        assert.equal(formatHourOfDay(null), null);
        assert.equal(formatHourOfDay(undefined), null);
    });

    test('a range wraps around midnight', () => {
        assert.equal(formatHourRange(9), '09:00–10:00');
        assert.equal(formatHourRange(23), '23:00–00:00');
        assert.equal(formatHourRange(22, 3), '22:00–01:00');
    });
});
