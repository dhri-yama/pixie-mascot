package dev.pixie

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private fun hex(n: UInt): String = n.toString(16).padStart(8, '0')
private fun gridHash(g: IntArray): String = hex(fnv1a(ByteArray(g.size) { g[it].toByte() }))

private fun golden(): JsonObject {
    val dir = System.getProperty("pixie.spec") ?: error("pixie.spec system property is not set")
    return JsonParser.parseString(File(dir, "golden.json").readText()).asJsonObject
}

class GoldenTest {
    /** spec/golden.json is the contract between every implementation. */
    @Test fun matchesGoldenFile() {
        val entries = golden().getAsJsonArray("entries")
        assertEquals(500, entries.size())
        var failures = 0
        val messages = ArrayList<String>()
        for (el in entries) {
            val e = el.asJsonObject
            val input = e["input"].asString
            val s = generate(input)
            fun <T> check(got: T, want: T, what: String) {
                if (got != want) {
                    failures++
                    if (messages.size < 15) messages.add("input ${input.take(40)}: $what was $got, golden says $want")
                }
            }
            check(hex(s.seed), e["seed"].asString, "seed")
            check(listOf(s.traits.roundness, s.traits.heft, s.traits.energy, s.traits.chaos, s.traits.slink), e["traits"].asJsonArray.map { it.asInt }, "traits")
            check(s.template.key, e["template"].asString, "template")
            check(s.mark.key, e["mark"].asString, "mark")
            check(s.eyeStyle.key, e["eyeStyle"].asString, "eyeStyle")
            check(listOf(s.anchors.eyeY, s.anchors.eyeInner, s.anchors.mouthY), e["anchors"].asJsonArray.map { it.asInt }, "anchors")
            check(s.colors.drop(1).joinToString(","), e["colors"].asString, "colors")
            check(gridHash(s.grid), e["grid"].asString, "grid")
            check(gridHash(s.body), e["body"].asString, "body")
            val moods = e["moods"].asJsonObject
            for (m in Mood.entries) check(gridHash(compose(s, Pose(m))), moods[m.key].asString, "mood ${m.key}")
            check(gridHash(compose(s, Pose(Mood.Thinking, Gaze(1, -1), blink = true, lift = 2, dx = 1, lean = -2, squash = 1, wave = 3, amp = 1))), e["pose"].asString, "pose")
            check(gridHash(compose(s, Pose(lean = 3, squash = -2))), e["squash"].asString, "squash")
            check(hex(fnv1a(utf8(toSVG(s.grid, s.colors)))), e["svg"].asString, "svg")
        }
        assertEquals(0, failures, messages.joinToString("\n"))
    }

    /** Replays the scripted inputs from spec/golden.json and compares the pose trace hash. */
    @Test fun behaviorTracesMatchGolden() {
        val behavior = golden().getAsJsonObject("behavior")
        val steps = behavior["steps"].asInt
        val stepMs = behavior["stepMs"].asInt
        val script = behavior.getAsJsonArray("script").map { it.asJsonObject }
        val cases = behavior.getAsJsonArray("cases").map { it.asJsonObject }
        assertEquals(10, cases.size)

        for (c in cases) {
            val text = c["text"].asString
            val sprite = generate(text)
            val mode = when (c["attention"].asString) {
                "always" -> AttentionMode.Always
                "never" -> AttentionMode.Never
                else -> AttentionMode.Sometimes
            }
            val b = Behavior(sprite.seed, sprite.traits, sprite.template, mode, c["reducedMotion"].asBoolean, c["sleepAfterMs"].asInt)
            val trace = StringBuilder()
            var asleepSteps = 0
            var blinks = 0
            var next = 0
            for (i in 0 until steps) {
                val t = i * stepMs
                while (next < script.size && script[next]["t"].asInt <= t) {
                    val e = script[next++]
                    val vec = if (e.has("x")) Vec(e["x"].asDouble, e["y"].asDouble) else null
                    when (val op = e["op"].asString) {
                        "lookAt" -> b.lookAt(vec)
                        "focus" -> b.focus(vec)
                        "react" -> b.react(Mood.named(e["mood"].asString)!!, e["ms"].asInt)
                        "setMood" -> b.setMood(if (e.has("mood")) Mood.named(e["mood"].asString) else null)
                        "poke" -> b.poke()
                        "clearReaction" -> b.clearReaction()
                        else -> error("unknown op $op")
                    }
                }
                val p = b.tick(stepMs)
                if (b.attention == Attention.Asleep) asleepSteps++
                if (p.blink) blinks++
                trace.append("${p.mood.key},${p.gaze.x},${p.gaze.y},${if (p.blink) 1 else 0},${p.lift},${p.dx},${p.lean},${p.squash},${p.wave},${p.amp},${b.attention.key};")
            }
            assertEquals(c["hash"].asString, hex(fnv1a(utf8(trace.toString()))), "behavior trace for $text")
            assertEquals(c["asleepSteps"].asInt, asleepSteps, "asleep steps for $text")
            assertEquals(c["blinks"].asInt, blinks, "blinks for $text")
        }
        assertTrue(cases.isNotEmpty())
    }
}
