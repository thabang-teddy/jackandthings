import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    cmToMillimetres,
    formatBodyFat,
    formatDistance,
    formatKg,
    formatSeconds,
    formatSet,
    formatTape,
    formatVolume,
    gramsToKg,
    kgToGrams,
    millimetresToCm,
    percentToPermille,
    permilleToPercent,
} from './formatWorkout.js';

/**
 * Turning the integers the server stores into something a person reads.
 *
 * The round-trip tests matter most: a form converts kilograms to grams on the
 * way out and back on the way in, and a conversion that loses half a kilogram
 * would silently rewrite somebody's logged lift.
 */

describe('formatKg', () => {
    test('a whole number carries no pointless decimals', () => {
        assert.equal(formatKg(60000), '60 kg');
    });

    test('a half kilogram survives', () => {
        assert.equal(formatKg(62500), '62.5 kg');
    });

    test('not measured is null, not a zero', () => {
        assert.equal(formatKg(null), null);
        assert.equal(formatKg(undefined), null);
        assert.equal(formatKg(''), null);
    });

    test('zero is a real figure and formats as one', () => {
        assert.equal(formatKg(0), '0 kg');
    });
});

describe('formatDistance', () => {
    test('a short interval reads in metres', () => {
        // "0.4 km" for a 400m interval would read as a rounding error.
        assert.equal(formatDistance(400), '400 m');
    });

    test('a kilometre and over reads in kilometres', () => {
        assert.equal(formatDistance(5000), '5 km');
        assert.equal(formatDistance(5250), '5.25 km');
    });
});

describe('formatSeconds', () => {
    test('under an hour it is a clock', () => {
        assert.equal(formatSeconds(90), '1:30');
        assert.equal(formatSeconds(5), '0:05');
    });

    test('an hour and over it is hours and minutes', () => {
        // "120:00" for a two-hour ride is not a reading anybody wants.
        assert.equal(formatSeconds(7200), '2h');
        assert.equal(formatSeconds(5400), '1h 30m');
    });
});

describe('formatBodyFat and formatTape', () => {
    test('permille reads as a percentage with its half point', () => {
        assert.equal(formatBodyFat(175), '17.5%');
    });

    test('millimetres read as centimetres, the way a tape is read', () => {
        assert.equal(formatTape(860), '86 cm');
        assert.equal(formatTape(865), '86.5 cm');
    });
});

describe('formatSet', () => {
    test('a lift reads as weight by reps', () => {
        assert.equal(formatSet({ weight_grams: 80000, reps: 5 }), '80 kg × 5');
    });

    test('bodyweight reps read as reps', () => {
        assert.equal(formatSet({ reps: 12 }), '12 reps');
        assert.equal(formatSet({ reps: 1 }), '1 rep');
    });

    test('a run reads as distance in time', () => {
        assert.equal(
            formatSet({ distance_metres: 5000, duration_seconds: 1470 }),
            '5 km in 24:30',
        );
    });

    test('a hold reads as time alone', () => {
        assert.equal(formatSet({ duration_seconds: 60 }), '1:00');
    });

    test('rpe is appended when it is there', () => {
        assert.equal(formatSet({ reps: 5, rpe: 8 }), '5 reps · RPE 8');
    });

    test('a set with no measures is a dash, not an empty cell', () => {
        assert.equal(formatSet({}), '—');
        assert.equal(formatSet(null), '—');
    });
});

describe('formatVolume', () => {
    test('it reads in kilograms', () => {
        assert.equal(formatVolume(300000), '300 kg');
    });

    test('it switches to tonnes once kilograms stop reading sensibly', () => {
        assert.equal(formatVolume(2_500_000), '2.5 t');
    });

    test('nothing lifted is zero, not a blank', () => {
        assert.equal(formatVolume(0), '0 kg');
        assert.equal(formatVolume(null), '0 kg');
    });
});

describe('round trips', () => {
    test('kilograms survive the trip to grams and back', () => {
        // A form reads grams, shows kilograms, and sends grams again. Losing
        // half a kilogram in there would rewrite a logged lift.
        for (const grams of [60000, 62500, 1000, 0]) {
            assert.equal(kgToGrams(gramsToKg(grams)), grams);
        }
    });

    test('centimetres survive the trip to millimetres and back', () => {
        for (const mm of [860, 865, 1000]) {
            assert.equal(cmToMillimetres(millimetresToCm(mm)), mm);
        }
    });

    test('a percentage survives the trip to permille and back', () => {
        for (const permille of [175, 180, 95]) {
            assert.equal(
                percentToPermille(permilleToPercent(permille)),
                permille,
            );
        }
    });

    test('a blank input converts to null rather than zero', () => {
        assert.equal(kgToGrams(''), null);
        assert.equal(cmToMillimetres(null), null);
        assert.equal(percentToPermille(undefined), null);
    });
});
