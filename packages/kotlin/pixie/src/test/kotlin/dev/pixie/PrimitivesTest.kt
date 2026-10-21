package dev.pixie

import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class PrimitivesTest {
    @Test fun fnvVectors() {
        assertEquals(0x811c9dc5u, fnv1a(byteArrayOf()))
        assertEquals(0xe40c292cu, fnv1a("a".toByteArray()))
        assertEquals(0xbf9cf968u, fnv1a("foobar".toByteArray()))
    }

    @Test fun rngVectors() {
        val r = Rng(1u)
        assertEquals(listOf(2693262067u, 11749833u, 2265367787u), listOf(r.next(), r.next(), r.next()))
    }

    @Test fun normalizeRules() {
        assertEquals("bubba bubba", normalize("  Bubba \t\n Bubba  "))
        assertEquals(normalize("café"), normalize("café"))
        assertEquals("É", normalize("É"))
        assertEquals("", normalize("   "))
        assertEquals(128, normalize("😀".repeat(200)).codePointCount(0, normalize("😀".repeat(200)).length))
    }

    @Test fun utf8ReplacesLoneSurrogates() {
        assertContentEquals(byteArrayOf(0xef.toByte(), 0xbf.toByte(), 0xbd.toByte()), utf8("\uD800"))
        assertContentEquals("aé€😀".toByteArray(Charsets.UTF_8), utf8("aé€😀"))
    }

    @Test fun generateBasics() {
        val a = generate("bubbanbbebb")
        val b = generate("  Bubbanbbebb ")
        assertContentEquals(a.grid, b.grid)
        assertEquals(SIZE * SIZE, a.grid.size)
        assertTrue(a.grid.all { it in 0..7 })
        assertTrue((0 until SIZE * BOB).all { a.body[it] == 0 })
        assertTrue(a.traits.roundness > 80)
        assertTrue(generate("jsakkkwaakiyy").traits.roundness < 40)
        assertFailsWith<IllegalArgumentException> { generate("x", version = 99) }
        assertEquals("#8bac0f", generate("bubba", palette = Preset.Gameboy).colors[1])
        assertTrue(a.summary.startsWith("A "))
    }

    @Test fun neverCrashesOnOddInput() {
        val rng = java.util.Random(7)
        repeat(500) {
            val sb = StringBuilder()
            repeat(rng.nextInt(40)) { sb.append(rng.nextInt(0xffff).toChar()) } // includes lone surrogates
            val sprite = generate(sb.toString())
            assertEquals(SIZE * SIZE, sprite.grid.size)
            for (m in Mood.entries) assertEquals(SIZE * SIZE, compose(sprite, Pose(m, blink = true, bob = true)).size)
        }
    }

    @Test fun svgHasOneRectPerRun() {
        val s = generate("jsakkkwaakiyy")
        val svg = s.svg(size = 96)
        assertTrue(svg.startsWith("<svg") && svg.contains("width=\"96\"") && svg.contains("aria-label=\"${s.summary}\""))
        assertEquals(runs(s.grid).size, svg.split("<rect").size - 1)
    }
}
