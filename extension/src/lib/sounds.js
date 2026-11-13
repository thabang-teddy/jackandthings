/**
 * The add-on's Pomodoro sounds, synthesised with Web Audio.
 *
 * Same recipes and the same wire names as the web app's Lib/audio/ and
 * Android's PomodoroSounds, so a preset sounds like itself wherever it runs,
 * and nothing is bundled - see laravel/resources/js/Lib/audio/audioContext.js
 * for why that matters.
 *
 * The honest limit: a Manifest V3 service worker has no AudioContext, so this
 * only plays in a document - the popup while it is open. An interval that
 * ends with the popup shut is announced by the notification the background
 * raises, which carries the browser's own sound. Chrome could host an
 * offscreen document to play audio in the background; Firefox has no such
 * API, and keeping one code path that works in both beats a sound that only
 * half the users get.
 */

const NOTE = { c5: 523.25, e5: 659.25, g5: 783.99, c6: 1046.5, a5: 880, d5: 587.33 };

let context = null;
let bed = null;
let bedName = null;

function ensureContext() {
    if (context) {
        if (context.state === 'suspended') context.resume().catch(() => {});

        return context;
    }

    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return null;

    try {
        context = new Ctor();
    } catch {
        context = null;
    }

    return context;
}

/** One enveloped oscillator; ramped rather than switched, or it clicks. */
function tone(ctx, { frequency, type, startAt, duration, peak }) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
}

const ALARMS = {
    chime: (ctx, at) =>
        [NOTE.e5, NOTE.g5, NOTE.c6].forEach((frequency, index) =>
            tone(ctx, {
                frequency,
                type: 'sine',
                startAt: at + index * 0.16,
                duration: 0.9,
                peak: 0.22,
            }),
        ),

    bell: (ctx, at) =>
        [0, 0.55].forEach((offset) =>
            [1, 2.76, 5.4].forEach((partial, index) =>
                tone(ctx, {
                    frequency: NOTE.c5 * partial,
                    type: 'sine',
                    startAt: at + offset,
                    duration: [2.2, 1.0, 0.45][index],
                    peak: [0.26, 0.08, 0.03][index],
                }),
            ),
        ),

    digital: (ctx, at) => {
        for (let index = 0; index < 3; index++) {
            tone(ctx, {
                frequency: NOTE.a5,
                type: 'square',
                startAt: at + index * 0.22,
                duration: 0.13,
                peak: 0.12,
            });
        }
    },

    marimba: (ctx, at) =>
        [NOTE.c5, NOTE.d5, NOTE.g5].forEach((frequency, index) =>
            tone(ctx, {
                frequency,
                type: 'triangle',
                startAt: at + index * 0.13,
                duration: 0.42,
                peak: 0.24,
            }),
        ),
};

const TICKS = {
    clock: { frequency: 2200, type: 'triangle', duration: 0.035, peak: 0.08 },
    soft: { frequency: 900, type: 'sine', duration: 0.05, peak: 0.028 },
};

export function playAlarm(name) {
    const play = ALARMS[name];
    const ctx = play ? ensureContext() : null;
    if (!ctx) return false;

    try {
        play(ctx, ctx.currentTime + 0.02);

        return true;
    } catch {
        return false;
    }
}

export function playTick(name) {
    const spec = TICKS[name];
    const ctx = spec ? ensureContext() : null;
    if (!ctx) return false;

    try {
        tone(ctx, { ...spec, startAt: ctx.currentTime + 0.01 });

        return true;
    } catch {
        return false;
    }
}

function noiseBuffer(ctx, brown) {
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let last = 0;

    for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (brown) {
            last = (last + 0.02 * white) / 1.02;
            samples[i] = last * 3.5;
        } else {
            samples[i] = white;
        }
    }

    return buffer;
}

/** Cutoff and level per bed; brown noise is what makes a room sound like one. */
const BEDS = {
    rain: { brown: false, cutoff: 2400, peak: 0.2 },
    cafe: { brown: true, cutoff: 900, peak: 0.24 },
    white_noise: { brown: false, cutoff: 7000, peak: 0.12 },
    brown_noise: { brown: true, cutoff: 1200, peak: 0.22 },
    // No chord loop here, unlike the web: the popup is closed most of the
    // time, so a scheduled progression would be cut off seconds in anyway.
    lofi: { brown: true, cutoff: 1600, peak: 0.16 },
};

export function startAmbience(name) {
    if (bedName === name) return true;

    stopAmbience();

    const spec = BEDS[name];
    const ctx = spec ? ensureContext() : null;
    if (!ctx) return false;

    try {
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer(ctx, spec.brown);
        source.loop = true;

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = spec.cutoff;

        const gain = ctx.createGain();
        gain.gain.value = spec.peak;

        source.connect(lowpass).connect(gain).connect(ctx.destination);
        source.start();

        bed = { source, gain };
        bedName = name;

        return true;
    } catch {
        return false;
    }
}

export function stopAmbience() {
    if (!bed) return;

    try {
        bed.source.stop();
        bed.source.disconnect();
        bed.gain.disconnect();
    } catch {
        // Already stopped.
    }

    bed = null;
    bedName = null;
}

export function ambiencePlaying() {
    return bedName;
}
