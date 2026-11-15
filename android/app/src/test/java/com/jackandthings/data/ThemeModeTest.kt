package com.jackandthings.data

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The appearance is persisted by its storage value, so the only logic worth
 * pinning is that a stored choice comes back unchanged and that anything else
 * - an unset key, a value from a newer build - lands on the safe default
 * instead of crashing the theme on launch.
 */
class ThemeModeTest {

    @Test
    fun `an unset preference follows the phone`() {
        assertEquals(ThemeMode.SYSTEM, ThemeMode.fromStorage(null))
    }

    @Test
    fun `every mode survives a storage round trip`() {
        ThemeMode.entries.forEach {
            assertEquals(it, ThemeMode.fromStorage(it.storageValue))
        }
    }

    @Test
    fun `an unknown value falls back to following the phone`() {
        assertEquals(ThemeMode.SYSTEM, ThemeMode.fromStorage("sepia"))
        assertEquals(ThemeMode.SYSTEM, ThemeMode.fromStorage(""))
    }

    @Test
    fun `the storage values are distinct so one choice cannot restore another`() {
        assertEquals(ThemeMode.entries.size, ThemeMode.entries.map { it.storageValue }.toSet().size)
    }
}
