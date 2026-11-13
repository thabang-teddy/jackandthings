import { ensureContext, masterGain } from './audioContext';

/**
 * The one-shot sounds: the end-of-interval alarm and the per-second tick.
 *
 * Each alarm is a short sequence of enveloped oscillators rather than a
 * sample - see audioContext.js for why nothing is bundled. The four differ in
 * waveform, partials and decay, which is enough to tell them apart by ear
 * without any of them being a recording of anything.
 */

/** Note frequencies the alarms are built from, in Hz. */
const NOTE = {
    c5: 523.25,
    e5: 659.25,
    g5: 783.99,
    c6: 1046.5,
    a4: 440,
    d5: 587.33,
};

/**
 * One enveloped oscillator. Gain is ramped rather than switched, because a
 * square edge on a gain node is an audible click in every browser.
 */
function tone(ctx, destination, { frequency, type, startAt, duration, peak }) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gain).connect(destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
}

/** A struck-metal body: a fundamental plus two inharmonic partials. */
function struck(ctx, destination, { frequency, startAt, duration, peak }) {
    tone(ctx, destination, {
        frequency,
        type: 'sine',
        startAt,
        duration,
        peak,
    });
    tone(ctx, destination, {
        frequency: frequency * 2.76,
        type: 'sine',
        startAt,
        duration: duration * 0.45,
        peak: peak * 0.3,
    });
    tone(ctx, destination, {
        frequency: frequency * 5.4,
        type: 'sine',
        startAt,
        duration: duration * 0.2,
        peak: peak * 0.12,
    });
}

const ALARMS = {
    // A rising three-note arpeggio; the gentlest of the four.
    chime: (ctx, out, at) => {
        [NOTE.e5, NOTE.g5, NOTE.c6].forEach((frequency, index) => {
            tone(ctx, out, {
                frequency,
                type: 'sine',
                startAt: at + index * 0.16,
                duration: 0.9,
                peak: 0.22,
            });
        });
    },

    // Two strikes with a long tail, like a service bell.
    bell: (ctx, out, at) => {
        struck(ctx, out, {
            frequency: NOTE.c5,
            startAt: at,
            duration: 2.2,
            peak: 0.26,
        });
        struck(ctx, out, {
            frequency: NOTE.c5,
            startAt: at + 0.55,
            duration: 1.8,
            peak: 0.18,
        });
    },

    // Three flat square beeps - the alarm-clock sound, deliberately plain.
    digital: (ctx, out, at) => {
        for (let index = 0; index < 3; index++) {
            tone(ctx, out, {
                frequency: NOTE.a4 * 2,
                type: 'square',
                startAt: at + index * 0.22,
                duration: 0.13,
                peak: 0.12,
            });
        }
    },

    // Wooden and short: triangle waves with almost no sustain.
    marimba: (ctx, out, at) => {
        [NOTE.c5, NOTE.d5, NOTE.g5].forEach((frequency, index) => {
            tone(ctx, out, {
                frequency,
                type: 'triangle',
                startAt: at + index * 0.13,
                duration: 0.42,
                peak: 0.24,
            });
        });
    },
};

export const ALARM_SOUNDS = Object.keys(ALARMS);

/**
 * Plays the named alarm. Unknown names and `'none'` are silence, not an
 * error: the value comes off a preset the server validated, but a client
 * reading a preset written by a newer client must still behave.
 */
export function playAlarm(name) {
    const play = ALARMS[name];
    if (!play) {
        return false;
    }

    const ctx = ensureContext();
    const out = masterGain();
    if (!ctx || !out) {
        return false;
    }

    try {
        play(ctx, out, ctx.currentTime + 0.02);

        return true;
    } catch {
        return false;
    }
}

const TICKS = {
    // A hard escapement click: a high triangle blip with an instant decay.
    clock: { frequency: 2200, type: 'triangle', duration: 0.035, peak: 0.08 },
    // The same gesture an octave down and much quieter, for people who want
    // to know it is running without being prodded every second.
    soft: { frequency: 900, type: 'sine', duration: 0.05, peak: 0.028 },
};

export const TICK_SOUNDS = Object.keys(TICKS);

export function playTick(name) {
    const spec = TICKS[name];
    if (!spec) {
        return false;
    }

    const ctx = ensureContext();
    const out = masterGain();
    if (!ctx || !out) {
        return false;
    }

    try {
        tone(ctx, out, { ...spec, startAt: ctx.currentTime + 0.01 });

        return true;
    } catch {
        return false;
    }
}
