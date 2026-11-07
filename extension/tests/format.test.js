import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    formatZar,
    formatClock,
    transferFlow,
    isCredit,
    TYPE_LABELS,
} from '../src/lib/format.js';

describe('formatZar', () => {
    test('renders integer cents as rands', () => {
        // Non-breaking spaces vary by ICU build, so compare on the digits.
        assert.match(formatZar(367_450).replace(/\s/g, ' '), /^R\s?3\s?674[.,]50$/);
    });

    test('zero and missing values both read as zero', () => {
        assert.match(formatZar(0).replace(/\s/g, ' '), /^R\s?0[.,]00$/);
        assert.match(formatZar(null).replace(/\s/g, ' '), /^R\s?0[.,]00$/);
        assert.match(formatZar(undefined).replace(/\s/g, ' '), /^R\s?0[.,]00$/);
    });

    test('cents never lose precision on the way to display', () => {
        assert.match(formatZar(12_550).replace(/\s/g, ' '), /12[.,]550?$|125[.,]50$/);
    });
});

describe('formatClock', () => {
    test('pads both halves', () => {
        assert.equal(formatClock(25 * 60), '25:00');
        assert.equal(formatClock(4 * 60 + 5), '04:05');
        assert.equal(formatClock(9), '00:09');
    });

    test('never shows a negative clock', () => {
        // The popup derives this from a stored end time, so a late wake-up
        // can hand it a negative number.
        assert.equal(formatClock(0), '00:00');
        assert.equal(formatClock(-30), '00:00');
    });

    test('counts past an hour in minutes', () => {
        assert.equal(formatClock(90 * 60), '90:00');
    });
});

describe('transferFlow', () => {
    const leg = (type, own, other) => ({
        type,
        account: own ? { id: 'a', name: own } : null,
        related_account: other ? { id: 'b', name: other } : null,
    });

    test('an outgoing leg reads source to destination', () => {
        assert.equal(transferFlow(leg('transfer_out', 'Cash', 'Savings')), 'Cash → Savings');
    });

    test('an incoming leg reads the same way, not reversed', () => {
        // The bug this guards: printing the fields in order would show
        // "Savings → Cash" for money that moved Cash → Savings.
        assert.equal(transferFlow(leg('transfer_in', 'Savings', 'Cash')), 'Cash → Savings');
    });

    test('both legs of one transfer agree', () => {
        assert.equal(
            transferFlow(leg('transfer_out', 'Cash', 'Savings')),
            transferFlow(leg('transfer_in', 'Savings', 'Cash')),
        );
    });

    test('a plain transaction shows one account', () => {
        assert.equal(transferFlow(leg('deposit', 'Cash', null)), 'Cash');
    });

    test('a missing account degrades rather than throwing', () => {
        assert.equal(transferFlow(leg('deposit', null, null)), '—');
    });
});

describe('type helpers', () => {
    test('credits and debits match the server enum', () => {
        assert.equal(isCredit('deposit'), true);
        assert.equal(isCredit('transfer_in'), true);
        assert.equal(isCredit('withdrawal'), false);
        assert.equal(isCredit('transfer_out'), false);
    });

    test('every server type has a label', () => {
        for (const type of ['deposit', 'withdrawal', 'transfer_in', 'transfer_out']) {
            assert.ok(TYPE_LABELS[type], `no label for ${type}`);
        }
    });
});
