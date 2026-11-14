import {
    audioSupported,
    releaseContext,
    setMasterVolume,
} from './audio/audioContext';
import { ALARM_SOUNDS, TICK_SOUNDS, playAlarm, playTick } from './audio/alarms';
import { AMBIENCE_SOUNDS, startAmbience, stopAmbience } from './audio/ambience';

/**
 * The sound half of the Pomodoro, as the timer sees it.
 *
 * useCountdown talks only to this module, never to Web Audio directly, for
 * two reasons: the Node test runner has no AudioContext and would otherwise
 * need one stubbed, and the add-on needs the same behaviour in a context
 * where the API differs. Every function here is safe to call when there is no
 * audio at all - it returns false and the timer carries on.
 *
 * The user's own on/off switch lives here too, next to a browser that may
 * have refused, so a caller never has to check both.
 */

const STORAGE_KEY = 'jackandthings:pomodoro-sound';

export const SOUND_OPTIONS = {
    alarm: ['none', ...ALARM_SOUNDS],
    ticking: ['none', ...TICK_SOUNDS],
    ambience: ['none', ...AMBIENCE_SOUNDS],
};

/** Human labels for the preset form; the values themselves go to the server. */
export const SOUND_LABELS = {
    none: 'None',
    chime: 'Chime',
    bell: 'Bell',
    digital: 'Digital',
    marimba: 'Marimba',
    clock: 'Clock tick',
    soft: 'Soft tick',
    rain: 'Rain',
    cafe: 'Cafe',
    white_noise: 'White noise',
    brown_noise: 'Brown noise',
    lofi: 'Lo-fi loop',
};

function readPreference() {
    try {
        // Default on: a preset that asks for a chime should chime without the
        // user having to find a second switch to allow it.
        return window.localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
        return true;
    }
}

function writePreference(on) {
    try {
        window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
        // Private browsing: the choice just will not survive a reload.
    }
}

export function soundsSupported() {
    return audioSupported();
}

export function soundsEnabled() {
    return audioSupported() && readPreference();
}

/** Returns the new state, so a caller can render without re-reading storage. */
export function setSoundsEnabled(on) {
    writePreference(on);

    if (!on) {
        stopAll();
    }

    return soundsEnabled();
}

export function setVolume(volume) {
    setMasterVolume(volume);
}

export function alarm(name) {
    return soundsEnabled() ? playAlarm(name) : false;
}

export function tick(name) {
    return soundsEnabled() ? playTick(name) : false;
}

/**
 * Starts or changes the background bed. Called every time the timer's phase
 * or running state changes, so it has to be cheap and idempotent - which it
 * is: ambience.js returns early when the requested bed is already playing.
 */
export function ambience(name) {
    if (!soundsEnabled() || !name || name === 'none') {
        stopAmbience();

        return false;
    }

    return startAmbience(name);
}

/** Silence everything and let go of the audio device. */
export function stopAll() {
    stopAmbience();
    releaseContext();
}
