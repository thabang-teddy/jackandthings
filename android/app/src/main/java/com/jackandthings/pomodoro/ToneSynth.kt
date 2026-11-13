package com.jackandthings.pomodoro

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin
import kotlin.random.Random

/**
 * PCM generated in-process, so the Pomodoro ships no audio assets.
 *
 * The issue asks for alarm sounds, ticking and background noise including
 * rain, cafe and lo-fi. Bundling those as files would mean redistributing
 * somebody's recordings; generating them means the APK grows by nothing and
 * there is no licence question. The web and the add-on do the same thing with
 * Web Audio - see laravel/resources/js/Lib/audio/.
 *
 * Playback is USAGE_MEDIA rather than USAGE_ALARM on purpose: this is a focus
 * aid, and an alarm-stream sound would ignore the user's media volume and cut
 * through Do Not Disturb, which strict mode has just asked for.
 */
object ToneSynth {

    const val SAMPLE_RATE = 44_100

    private val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

    private fun format(): AudioFormat = AudioFormat.Builder()
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .setSampleRate(SAMPLE_RATE)
        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
        .build()

    /** One partial, enveloped and mixed into [into] starting at [atSeconds]. */
    fun addTone(
        into: ShortArray,
        atSeconds: Double,
        frequency: Double,
        durationSeconds: Double,
        peak: Double,
        decay: Double = 6.0,
    ) {
        val start = (atSeconds * SAMPLE_RATE).toInt().coerceAtLeast(0)
        val length = (durationSeconds * SAMPLE_RATE).toInt()

        for (i in 0 until length) {
            val index = start + i
            if (index >= into.size) break

            val t = i.toDouble() / SAMPLE_RATE
            // Exponential decay with a short ramp in: a square edge on the
            // envelope is an audible click on every device.
            val attack = (t / 0.008).coerceAtMost(1.0)
            val envelope = attack * exp(-decay * t / durationSeconds)
            val sample = sin(2 * PI * frequency * t) * envelope * peak

            into[index] = mix(into[index], sample)
        }
    }

    /** Band-limited noise, which is what the rain and cafe beds are made of. */
    fun fillNoise(into: ShortArray, peak: Double, brown: Boolean, random: Random = Random.Default) {
        var last = 0.0

        for (i in into.indices) {
            val white = random.nextDouble(-1.0, 1.0)
            val value = if (brown) {
                last = (last + 0.02 * white) / 1.02
                last * 3.5
            } else {
                white
            }

            into[i] = mix(into[i], value * peak)
        }
    }

    private fun mix(existing: Short, sample: Double): Short {
        val summed = existing + (sample * Short.MAX_VALUE)

        return summed.coerceIn(Short.MIN_VALUE.toDouble(), Short.MAX_VALUE.toDouble()).toInt().toShort()
    }

    fun buffer(seconds: Double): ShortArray = ShortArray((seconds * SAMPLE_RATE).toInt())

    /**
     * A one-shot track that releases itself when it finishes. Returns null
     * rather than throwing when the device will not give out an AudioTrack -
     * sound is a nicety and must never take the timer down with it.
     */
    fun playOnce(samples: ShortArray): AudioTrack? = runCatching {
        val track = AudioTrack.Builder()
            .setAudioAttributes(attributes)
            .setAudioFormat(format())
            .setBufferSizeInBytes(samples.size * 2)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()

        track.write(samples, 0, samples.size)
        track.setNotificationMarkerPosition(samples.size)
        track.setPlaybackPositionUpdateListener(
            object : AudioTrack.OnPlaybackPositionUpdateListener {
                override fun onMarkerReached(played: AudioTrack?) {
                    runCatching { played?.release() }
                }

                override fun onPeriodicNotification(played: AudioTrack?) = Unit
            },
        )
        track.play()
        track
    }.getOrNull()

    /** A looping track, for the ambience beds. The caller owns releasing it. */
    fun playLooping(samples: ShortArray): AudioTrack? = runCatching {
        val track = AudioTrack.Builder()
            .setAudioAttributes(attributes)
            .setAudioFormat(format())
            .setBufferSizeInBytes(samples.size * 2)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()

        track.write(samples, 0, samples.size)
        track.setLoopPoints(0, samples.size, -1)
        track.play()
        track
    }.getOrNull()
}
