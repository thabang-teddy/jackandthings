package com.jackandthings.data

/**
 * Which appearance the app draws in, chosen in Settings.
 *
 * [SYSTEM] is the default and the only mode that reads the phone's own dark
 * mode. [LIGHT] and [DARK] override it, because a phone that dims on a
 * schedule is not always right about the room - and because the glass palette
 * and the Material screens both have to agree when it is overridden.
 *
 * It is stored by [storageValue] rather than by enum name so renaming a
 * constant cannot silently reset somebody's choice on their next launch.
 */
enum class ThemeMode(val storageValue: String) {
    SYSTEM("system"),
    LIGHT("light"),
    DARK("dark"),
    ;

    companion object {
        /**
         * An unset or unrecognised value - a wiped preference file, or a value
         * written by a newer build - falls back to following the phone rather
         * than throwing. An appearance is not worth a crash on launch.
         */
        fun fromStorage(value: String?): ThemeMode =
            entries.firstOrNull { it.storageValue == value } ?: SYSTEM
    }
}
