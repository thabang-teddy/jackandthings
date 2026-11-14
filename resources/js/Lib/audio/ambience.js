import { ensureContext, masterGain, noiseBuffer } from './audioContext';

/**
 * The looping background beds held under a focus interval: rain, a cafe,
 * white and brown noise, and a lo-fi loop.
 *
 * All five are generated. Rain and cafe are shaped noise with slow movement
 * on top; lo-fi is a four-chord progression over vinyl crackle. See
 * audioContext.js for why this is synthesis rather than audio files.
 *
 * Each builder returns the nodes it created so stop() can tear the whole bed
 * down - a looping source left running is a page that hums forever.
 */

/** Seconds the bed fades in and out over, so starting is not a thump. */
const FADE_SECONDS = 1.2;

function noiseSource(ctx, kind) {
    const buffer = noiseBuffer(kind);
    if (!buffer) {
        return null;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    return source;
}

/** A gain node whose value drifts slowly, which is what stops a bed sounding flat. */
function drift(ctx, { depth, periodSeconds, centre }) {
    const gain = ctx.createGain();
    gain.gain.value = centre;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / periodSeconds;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = depth;

    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    return { gain, nodes: [lfo] };
}

/** Steady rainfall: white noise with the extremes trimmed, breathing slowly. */
function buildRain(ctx, out) {
    const source = noiseSource(ctx, 'white');
    if (!source) {
        return null;
    }

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2400;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 420;

    const { gain, nodes } = drift(ctx, {
        depth: 0.05,
        periodSeconds: 9,
        centre: 0.2,
    });

    source.connect(highpass).connect(lowpass).connect(gain).connect(out);
    source.start();

    return { sources: [source], nodes, gain };
}

/** A room: brown noise rolled off low, with a slower, deeper sway than rain. */
function buildCafe(ctx, out) {
    const source = noiseSource(ctx, 'brown');
    if (!source) {
        return null;
    }

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 900;

    const peaking = ctx.createBiquadFilter();
    peaking.type = 'peaking';
    peaking.frequency.value = 320;
    peaking.gain.value = 4;

    const { gain, nodes } = drift(ctx, {
        depth: 0.07,
        periodSeconds: 14,
        centre: 0.24,
    });

    source.connect(lowpass).connect(peaking).connect(gain).connect(out);
    source.start();

    return { sources: [source], nodes, gain };
}

function buildNoise(kind) {
    return (ctx, out) => {
        const source = noiseSource(ctx, kind);
        if (!source) {
            return null;
        }

        const gain = ctx.createGain();
        gain.gain.value = kind === 'brown' ? 0.22 : 0.12;

        // Even "white" noise gets its top trimmed: a full-spectrum bed at
        // listening volume is fatiguing within minutes, which defeats the point.
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = kind === 'brown' ? 1200 : 7000;

        source.connect(lowpass).connect(gain).connect(out);
        source.start();

        return { sources: [source], nodes: [], gain };
    };
}

/** The lo-fi progression, as semitone offsets from the root of each chord. */
const LOFI_CHORDS = [
    [0, 3, 7, 10],
    [-2, 2, 5, 9],
    [-4, 0, 3, 7],
    [-5, -1, 2, 7],
];
const LOFI_ROOT = 220;
const LOFI_CHORD_SECONDS = 4;

/**
 * Four lazy chords on a loop under vinyl crackle. Not a recording of anyone's
 * beat - it is a scheduled arpeggio, which is the honest version of "lo-fi
 * beats" that can live in a repository.
 */
function buildLoFi(ctx, out) {
    const bed = ctx.createGain();
    bed.gain.value = 0.16;
    bed.connect(out);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1800;
    lowpass.connect(bed);

    const nodes = [];
    const startAt = ctx.currentTime + 0.1;

    LOFI_CHORDS.forEach((chord, bar) => {
        chord.forEach((semitones, voice) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const at = startAt + bar * LOFI_CHORD_SECONDS + voice * 0.18;

            osc.type = voice === 0 ? 'triangle' : 'sine';
            osc.frequency.value = LOFI_ROOT * 2 ** (semitones / 12);

            gain.gain.setValueAtTime(0, at);
            gain.gain.linearRampToValueAtTime(0.3, at + 0.25);
            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                at + LOFI_CHORD_SECONDS,
            );

            osc.connect(gain).connect(lowpass);
            osc.start(at);
            nodes.push(osc, gain);
        });
    });

    // Crackle: band-limited noise at a low level, which is what sells it as
    // vinyl rather than as a synth pad.
    const crackle = noiseSource(ctx, 'white');
    const sources = [];
    if (crackle) {
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 3600;
        band.Q.value = 0.8;

        const crackleGain = ctx.createGain();
        crackleGain.gain.value = 0.02;

        crackle.connect(band).connect(crackleGain).connect(bed);
        crackle.start();
        sources.push(crackle);
    }

    return {
        sources,
        nodes,
        gain: bed,
        loopSeconds: LOFI_CHORDS.length * LOFI_CHORD_SECONDS,
    };
}

const BEDS = {
    rain: buildRain,
    cafe: buildCafe,
    white_noise: buildNoise('white'),
    brown_noise: buildNoise('brown'),
    lofi: buildLoFi,
};

export const AMBIENCE_SOUNDS = Object.keys(BEDS);

let active = null;
let loopHandle = null;

function teardown(bed, ctx) {
    const at = ctx.currentTime;

    try {
        bed.gain.gain.cancelScheduledValues(at);
        bed.gain.gain.setValueAtTime(bed.gain.gain.value, at);
        bed.gain.gain.linearRampToValueAtTime(0, at + FADE_SECONDS);
    } catch {
        // A disconnected graph is already silent; nothing to ramp.
    }

    window.setTimeout(
        () => {
            [...bed.sources, ...bed.nodes].forEach((node) => {
                try {
                    node.stop?.();
                    node.disconnect();
                } catch {
                    // Already stopped by a previous teardown.
                }
            });

            try {
                bed.gain.disconnect();
            } catch {
                // Same.
            }
        },
        FADE_SECONDS * 1000 + 100,
    );
}

/**
 * Starts the named bed, replacing whatever was playing. `'none'` and unknown
 * names stop everything, which is also how a preset written by a newer client
 * degrades rather than throwing.
 */
export function startAmbience(name) {
    if (active?.name === name) {
        return true;
    }

    stopAmbience();

    const build = BEDS[name];
    if (!build) {
        return false;
    }

    const ctx = ensureContext();
    const out = masterGain();
    if (!ctx || !out) {
        return false;
    }

    let bed;
    try {
        bed = build(ctx, out);
    } catch {
        return false;
    }

    if (!bed) {
        return false;
    }

    const target = bed.gain.gain.value;
    bed.gain.gain.setValueAtTime(0, ctx.currentTime);
    bed.gain.gain.linearRampToValueAtTime(
        target,
        ctx.currentTime + FADE_SECONDS,
    );

    active = { name, bed };

    // Scheduled beds (lo-fi) have a finite length, so they are rebuilt rather
    // than looped by the source node. The noise beds loop on their own.
    if (bed.loopSeconds) {
        loopHandle = window.setTimeout(() => {
            active = null;
            startAmbience(name);
        }, bed.loopSeconds * 1000);
    }

    return true;
}

export function stopAmbience() {
    if (loopHandle !== null) {
        window.clearTimeout(loopHandle);
        loopHandle = null;
    }

    if (!active) {
        return;
    }

    const ctx = ensureContext();
    if (ctx) {
        teardown(active.bed, ctx);
    }

    active = null;
}

export function ambiencePlaying() {
    return active?.name ?? null;
}
