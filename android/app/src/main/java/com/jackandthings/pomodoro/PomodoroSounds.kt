package com.jackandthings.pomodoro

import android.media.AudioTrack

/**
 * The Android half of the Pomodoro's sound: the end-of-interval alarm, the
 * optional per-second tick, and the background bed held under a focus run.
 *
 * Every name here matches the enums the server validates
 * (App\Enums\PomodoroSound / PomodoroTicking / PomodoroAmbience) and the web
 * implementation in Lib/audio/, so the same preset sounds like itself on
 * every surface. An unknown name is silence rather than a crash, which is how
 * a preset written by a newer client degrades.
 *
 * Context-free so the engine stays testable, and stateful only in [ambience],
 * which owns the one looping track.
 */
object PomodoroSounds {

    private const val C5 = 523.25
    private const val E5 = 659.25
    private const val G5 = 783.99
    private const val C6 = 1046.5
    private const val A5 = 880.0
    private const val D5 = 587.33

    /** Seconds of bed per loop: long enough that the seam is not audible. */
    private const val BED_SECONDS = 4.0

    private var bed: AudioTrack? = null
    private var bedName: String? = null

    /** Muting is a user setting, kept here so callers need not check twice. */
    @Volatile
    var enabled: Boolean = true
        set(value) {
            field = value
            if (!value) stopAmbience()
        }

    fun playAlarm(name: String) {
        if (!enabled) return

        val samples = when (name) {
            "chime" -> arpeggio(listOf(E5, G5, C6), spacing = 0.16, duration = 0.9, peak = 0.3)
            "bell" -> bell()
            "digital" -> beeps()
            "marimba" -> arpeggio(listOf(C5, D5, G5), spacing = 0.13, duration = 0.42, peak = 0.32)
            else -> return
        }

        ToneSynth.playOnce(samples)
    }

    fun playTick(name: String) {
        if (!enabled) return

        val samples = when (name) {
            "clock" -> ToneSynth.buffer(0.05).also {
                ToneSynth.addTone(it, 0.0, 2200.0, 0.035, 0.10, decay = 30.0)
            }
            "soft" -> ToneSynth.buffer(0.06).also {
                ToneSynth.addTone(it, 0.0, 900.0, 0.05, 0.04, decay = 24.0)
            }
            else -> return
        }

        ToneSynth.playOnce(samples)
    }

    /**
     * Starts or changes the background bed. Idempotent: asking for the bed
     * that is already playing leaves it alone rather than restarting it, so
     * this is safe to call on every state change.
     */
    fun startAmbience(name: String) {
        if (!enabled || name == "none") {
            stopAmbience()
            return
        }

        if (bedName == name && bed != null) return

        stopAmbience()

        val samples = when (name) {
            // Shaped noise: brown reads as a room, white as weather. These
            // are the same recipes the web uses, minus its filter graph -
            // the peak levels stand in for the lowpass.
            "rain" -> ToneSynth.buffer(BED_SECONDS).also { ToneSynth.fillNoise(it, 0.16, brown = false) }
            "cafe" -> ToneSynth.buffer(BED_SECONDS).also { ToneSynth.fillNoise(it, 0.22, brown = true) }
            "white_noise" -> ToneSynth.buffer(BED_SECONDS).also { ToneSynth.fillNoise(it, 0.12, brown = false) }
            "brown_noise" -> ToneSynth.buffer(BED_SECONDS).also { ToneSynth.fillNoise(it, 0.20, brown = true) }
            "lofi" -> lofi()
            else -> return
        }

        bed = ToneSynth.playLooping(samples)
        bedName = if (bed == null) null else name
    }

    fun stopAmbience() {
        runCatching {
            bed?.pause()
            bed?.flush()
            bed?.release()
        }
        bed = null
        bedName = null
    }

    /** What is playing, for tests and for the screen's "sound on" state. */
    fun ambiencePlaying(): String? = bedName

    private fun arpeggio(
        notes: List<Double>,
        spacing: Double,
        duration: Double,
        peak: Double,
    ): ShortArray {
        val samples = ToneSynth.buffer(spacing * notes.size + duration)
        notes.forEachIndexed { index, frequency ->
            ToneSynth.addTone(samples, index * spacing, frequency, duration, peak)
        }

        return samples
    }

    /** Two strikes with inharmonic partials and a long tail, like a service bell. */
    private fun bell(): ShortArray {
        val samples = ToneSynth.buffer(3.2)

        listOf(0.0 to 0.34, 0.55 to 0.24).forEach { (at, peak) ->
            ToneSynth.addTone(samples, at, C5, 2.2, peak, decay = 4.0)
            ToneSynth.addTone(samples, at, C5 * 2.76, 1.0, peak * 0.3, decay = 7.0)
            ToneSynth.addTone(samples, at, C5 * 5.4, 0.45, peak * 0.12, decay = 9.0)
        }

        return samples
    }

    /** Three flat beeps - the alarm-clock sound, deliberately plain. */
    private fun beeps(): ShortArray {
        val samples = ToneSynth.buffer(0.8)
        repeat(3) { index ->
            ToneSynth.addTone(samples, index * 0.22, A5, 0.13, 0.18, decay = 1.0)
        }

        return samples
    }

    /**
     * A single sustained chord over noise crackle, looped.
     *
     * The web version schedules a four-bar progression; a looping PCM buffer
     * cannot change between bars, so this is the honest Android equivalent -
     * one warm chord and vinyl texture, not a beat. Named "lofi" to match the
     * shared enum, but it is not pretending to be a track.
     */
    private fun lofi(): ShortArray {
        val samples = ToneSynth.buffer(BED_SECONDS)
        ToneSynth.fillNoise(samples, 0.02, brown = false)

        listOf(220.0, 261.63, 329.63, 392.0).forEach { frequency ->
            ToneSynth.addTone(samples, 0.0, frequency, BED_SECONDS, 0.09, decay = 0.6)
        }

        return samples
    }
}
