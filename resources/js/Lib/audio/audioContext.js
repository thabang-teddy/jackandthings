/**
 * The one AudioContext the Pomodoro sounds share, plus the noise buffers the
 * ambience beds are built from.
 *
 * Everything here is synthesised. The issue asked for alarm sounds, ticking
 * and background noise including rain, cafe and lo-fi; shipping those as audio
 * files would mean redistributing somebody's recordings, so instead each one
 * is generated from oscillators and shaped noise. The whole feature therefore
 * adds no asset bytes to the bundle and no licence question.
 *
 * A browser will not let a page make sound before the user has interacted
 * with it, so the context is created lazily on the first play - which only
 * ever happens from a click (Start) or from a timer the user started.
 */

let context = null;
let master = null;
const noiseBuffers = new Map();

/** Seconds of noise per buffer: long enough that the loop is not audible. */
const NOISE_SECONDS = 4;

function AudioContextClass() {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.AudioContext ?? window.webkitAudioContext ?? null;
}

export function audioSupported() {
    return AudioContextClass() !== null;
}

/**
 * The shared context, or null where Web Audio is missing or refused. Every
 * caller treats null as "stay silent" rather than an error: sound is a
 * nicety and must never break the timer around it.
 */
export function ensureContext() {
    if (context) {
        if (context.state === 'suspended') {
            // Resuming can reject (no gesture yet); that is fine, the next
            // play attempt will try again.
            context.resume().catch(() => {});
        }

        return context;
    }

    const Ctor = AudioContextClass();
    if (!Ctor) {
        return null;
    }

    try {
        context = new Ctor();
        master = context.createGain();
        master.gain.value = 1;
        master.connect(context.destination);
    } catch {
        context = null;
        master = null;
    }

    return context;
}

/** Everything the Pomodoro plays goes through here, so one gain mutes it all. */
export function masterGain() {
    ensureContext();

    return master;
}

export function setMasterVolume(volume) {
    const gain = masterGain();
    if (!gain) {
        return;
    }

    gain.gain.value = Math.min(Math.max(volume, 0), 1);
}

/**
 * A looping noise buffer. `'white'` is uniform; `'brown'` is integrated white
 * noise, which rolls off the high end and reads as much warmer - that is what
 * makes the rain and cafe beds sound like weather and a room rather than like
 * static.
 */
export function noiseBuffer(kind = 'white') {
    const ctx = ensureContext();
    if (!ctx) {
        return null;
    }

    const cached = noiseBuffers.get(kind);
    if (cached) {
        return cached;
    }

    const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);

    if (kind === 'brown') {
        let last = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            last = (last + 0.02 * white) / 1.02;
            samples[i] = last * 3.5;
        }
    } else {
        for (let i = 0; i < length; i++) {
            samples[i] = Math.random() * 2 - 1;
        }
    }

    noiseBuffers.set(kind, buffer);

    return buffer;
}

/**
 * Releases the context and the cached buffers. Called when the last sound
 * stops, so a page left open overnight is not holding an audio device awake.
 */
export function releaseContext() {
    if (!context) {
        return;
    }

    const closing = context;
    context = null;
    master = null;
    noiseBuffers.clear();

    closing.close().catch(() => {});
}
