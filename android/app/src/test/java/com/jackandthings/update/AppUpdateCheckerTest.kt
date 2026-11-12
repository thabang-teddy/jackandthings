package com.jackandthings.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The pure half of the update check: comparing version strings and parsing
 * GitHub's "latest release" response. The network call itself is untested,
 * same as the rest of this app's HTTP-calling code (see docs/TESTING.md).
 */
class AppUpdateCheckerTest {

    @Test
    fun `a higher patch number reads as newer`() {
        assertTrue(isNewer("0.1.48", "0.1.47"))
        assertFalse(isNewer("0.1.47", "0.1.48"))
    }

    @Test
    fun `a double-digit patch number is not mistaken for older by string order`() {
        // "0.1.9" < "0.1.10" numerically, but ">" as plain strings.
        assertTrue(isNewer("0.1.10", "0.1.9"))
        assertFalse(isNewer("0.1.9", "0.1.10"))
    }

    @Test
    fun `an identical version is not newer`() {
        assertFalse(isNewer("0.1.47", "0.1.47"))
    }

    @Test
    fun `a missing component counts as zero`() {
        assertTrue(isNewer("0.2", "0.1.9"))
        assertFalse(isNewer("0.1", "0.1.0"))
    }

    @Test
    fun `a leading v is tolerated the way a hand-tagged release might use it`() {
        assertTrue(isNewer("v0.1.48", "0.1.47"))
    }

    @Test
    fun `parses tag and url out of a release body`() {
        val body = """{"tag_name": "0.1.48", "html_url": "https://github.com/x/y/releases/tag/0.1.48"}"""

        val version = parseLatestRelease(body)

        assertEquals("0.1.48", version?.versionName)
        assertEquals("https://github.com/x/y/releases/tag/0.1.48", version?.downloadUrl)
    }

    @Test
    fun `a response missing a field is not trusted rather than half-used`() {
        assertNull(parseLatestRelease("""{"tag_name": "0.1.48"}"""))
        assertNull(parseLatestRelease("""{"html_url": "https://example.com"}"""))
    }

    @Test
    fun `malformed JSON degrades to no update rather than crashing on launch`() {
        assertNull(parseLatestRelease("not json"))
        assertNull(parseLatestRelease(""))
    }
}
