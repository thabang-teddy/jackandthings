import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_REST_SECONDS,
    beatsPrevious,
    bestOf,
    estimatedOneRepMax,
    fieldsFor,
    nextSet,
    restSecondsFor,
    routineProgress,
    volumeGrams,
} from '../src/lib/workoutProgress.js';

/**
 * The add-on's copy of the shared workout rules.
 *
 * Deliberately the same vectors as
 * laravel/resources/js/Lib/workoutProgress.test.js and
 * laravel/tests/Feature/Services/WorkoutRecordsTest.php. Where a number
 * appears in all three, it is the same number on purpose: if one copy of the
 * rules is changed alone, this file fails and says so, rather than the
 * surfaces quietly disagreeing about what a personal record is and telling
 * the user different things on different devices.
 *
 * This mirrors the pomodoroCycle.test.js pair that already sits beside it.
 */

describe('fieldsFor', () => {
    test('a weight-and-reps exercise asks for exactly those two', () => {
        assert.deepEqual(fieldsFor('weight_reps'), {
            weight: true,
            reps: true,
            distance: false,
            duration: false,
        });
    });

    test('a timed hold asks only for time', () => {
        assert.deepEqual(fieldsFor('duration'), {
            weight: false,
            reps: false,
            distance: false,
            duration: true,
        });
    });

    test('a run asks for distance and time, never a weight', () => {
        const fields = fieldsFor('distance_duration');

        assert.equal(fields.distance, true);
        assert.equal(fields.duration, true);
        assert.equal(fields.weight, false);
    });

    test('an unknown metric asks for everything rather than nothing', () => {
        // A client one version behind a newer server should still be able to
        // log a set, rather than being shown a form with no inputs.
        assert.deepEqual(fieldsFor('something_new'), {
            weight: true,
            reps: true,
            distance: true,
            duration: true,
        });
    });
});

describe('estimatedOneRepMax', () => {
    test('a single rep is its own one-rep max', () => {
        // Epley would inflate a single by a thirtieth, reporting a heavier max
        // than the user has ever actually lifted.
        assert.equal(estimatedOneRepMax(100000, 1), 100000);
    });

    test('epley applies above one rep', () => {
        // The same vector as WorkoutRecordsTest: 62.5kg x 5.
        assert.equal(estimatedOneRepMax(62500, 5), 72917);
    });

    test('it needs both a load and a rep count', () => {
        assert.equal(estimatedOneRepMax(null, 5), null);
        assert.equal(estimatedOneRepMax(100000, null), null);
        assert.equal(estimatedOneRepMax(100000, 0), null);
    });

    test('an empty string is not a zero', () => {
        assert.equal(estimatedOneRepMax('', 5), null);
    });
});

describe('volumeGrams', () => {
    test('it is weight times reps', () => {
        assert.equal(volumeGrams({ weight_grams: 60000, reps: 5 }), 300000);
    });

    test('a run has no volume', () => {
        // Volume is a strength measure; a 5km run contributing to it would
        // make the figure meaningless.
        assert.equal(volumeGrams({ distance_metres: 5000, duration_seconds: 1470 }), 0);
    });
});

describe('bestOf', () => {
    test('warm-ups count towards nothing', () => {
        const best = bestOf([
            { weight_grams: 60000, reps: 5 },
            { weight_grams: 200000, reps: 20, is_warmup: true },
        ]);

        assert.equal(best.weight_grams, 60000);
        assert.equal(best.reps, 5);
    });

    test('a measure nothing carried is null, not zero', () => {
        const best = bestOf([{ weight_grams: 60000, reps: 5 }]);

        // Zero would read as a terrible run rather than as "never ran".
        assert.equal(best.distance_metres, null);
        assert.equal(best.duration_seconds, null);
    });

    test('an empty list is all nulls', () => {
        assert.deepEqual(bestOf([]), {
            one_rep_max_grams: null,
            weight_grams: null,
            reps: null,
            distance_metres: null,
            duration_seconds: null,
        });
    });
});

describe('beatsPrevious', () => {
    test('a first-ever set is a record', () => {
        assert.equal(beatsPrevious({ weight_grams: 40000, reps: 5 }, null), true);
    });

    test('a heavier set beats a lighter best', () => {
        assert.equal(
            beatsPrevious({ weight_grams: 110000, reps: 5 }, { weight_grams: 100000 }),
            true,
        );
    });

    test('a lighter set does not', () => {
        assert.equal(
            beatsPrevious(
                { weight_grams: 80000, reps: 5 },
                { weight_grams: 100000, reps: 5, one_rep_max_grams: 116667 },
            ),
            false,
        );
    });

    test('more reps at a lighter load still counts', () => {
        // A rep PR must not go unnoticed just because the bar was lighter.
        assert.equal(
            beatsPrevious(
                { weight_grams: 60000, reps: 12 },
                { weight_grams: 100000, reps: 5, one_rep_max_grams: 116667 },
            ),
            true,
        );
    });

    test('a warm-up is never a record', () => {
        assert.equal(
            beatsPrevious({ weight_grams: 200000, reps: 20, is_warmup: true }, null),
            false,
        );
    });

    test('a measure the set does not carry is ignored, not counted as a loss', () => {
        // The set has no distance; a previous best distance must not make it
        // "not a record" when its weight is one.
        assert.equal(
            beatsPrevious({ weight_grams: 200000, reps: 1 }, { distance_metres: 5000 }),
            true,
        );
    });
});

describe('restSecondsFor', () => {
    test("the routine item's own figure wins", () => {
        assert.equal(restSecondsFor({ rest_seconds: 45 }), 45);
    });

    test('a routine built without rest times still drives a usable timer', () => {
        assert.equal(restSecondsFor({}), DEFAULT_REST_SECONDS);
        assert.equal(restSecondsFor(null), DEFAULT_REST_SECONDS);
        assert.equal(restSecondsFor({ rest_seconds: 0 }), DEFAULT_REST_SECONDS);
    });
});

describe('nextSet', () => {
    const items = [
        { exercise_id: 'squat', position: 0, target_sets: 2, rest_seconds: 60 },
        { exercise_id: 'bench', position: 1, target_sets: 1 },
    ];

    test('it starts at the first exercise', () => {
        const next = nextSet(items, []);

        assert.equal(next.exercise_id, 'squat');
        assert.equal(next.setNumber, 1);
        assert.equal(next.targetSets, 2);
        assert.equal(next.restSeconds, 60);
    });

    test('it counts up within one exercise before moving on', () => {
        const next = nextSet(items, [{ exercise_id: 'squat' }]);

        assert.equal(next.exercise_id, 'squat');
        assert.equal(next.setNumber, 2);
    });

    test('it moves on once a target is met', () => {
        const next = nextSet(items, [
            { exercise_id: 'squat' },
            { exercise_id: 'squat' },
        ]);

        assert.equal(next.exercise_id, 'bench');
    });

    test('warm-ups do not count towards a target', () => {
        // Preparation is not the work the routine asked for.
        const next = nextSet(items, [{ exercise_id: 'squat', is_warmup: true }]);

        assert.equal(next.setNumber, 1);
    });

    test('it follows position, not array order', () => {
        const shuffled = [
            { exercise_id: 'bench', position: 1, target_sets: 1 },
            { exercise_id: 'squat', position: 0, target_sets: 1 },
        ];

        assert.equal(nextSet(shuffled, []).exercise_id, 'squat');
    });

    test('a finished routine has no next set', () => {
        const done = [
            { exercise_id: 'squat' },
            { exercise_id: 'squat' },
            { exercise_id: 'bench' },
        ];

        assert.equal(nextSet(items, done), null);
    });

    test('an item with no target counts as one set', () => {
        const untargeted = [{ exercise_id: 'plank', position: 0 }];

        assert.equal(nextSet(untargeted, []).targetSets, 1);
        assert.equal(nextSet(untargeted, [{ exercise_id: 'plank' }]), null);
    });
});

describe('routineProgress', () => {
    const items = [
        { exercise_id: 'squat', position: 0, target_sets: 3 },
        { exercise_id: 'bench', position: 1, target_sets: 2 },
    ];

    test('it counts target sets rather than exercises', () => {
        // Three exercises at four sets each should read 12, not 3.
        assert.deepEqual(routineProgress(items, []), {
            done: 0,
            target: 5,
            complete: false,
        });
    });

    test('extra sets cannot report more than the target', () => {
        const many = Array.from({ length: 9 }, () => ({ exercise_id: 'squat' }));

        assert.deepEqual(routineProgress(items, many), {
            done: 5,
            target: 5,
            complete: true,
        });
    });

    test('warm-ups do not advance it', () => {
        const progress = routineProgress(items, [
            { exercise_id: 'squat', is_warmup: true },
        ]);

        assert.equal(progress.done, 0);
    });
});
