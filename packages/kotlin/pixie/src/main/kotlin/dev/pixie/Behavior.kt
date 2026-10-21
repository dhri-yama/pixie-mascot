package dev.pixie

// Spec: spec/behavior.md. Pure, seeded state machine: no clock, no system randomness.
// The host calls tick(dtMs) about 10 times a second and draws the returned Pose with compose().

public enum class Attention(public val key: String) { Follow("follow"), Wander("wander"), Focus("focus"), Asleep("asleep") }
public enum class AttentionMode { Always, Sometimes, Never }

/** How a mascot idles. Chosen from its body shape. */
public enum class Motion(public val key: String) {
    Bounce("bounce"), Sway("sway"), Waddle("waddle"), Slither("slither"), Float("float"), Pulse("pulse"),
}

/** A direction from the mascot to something. Length about 1 means "far away". */
public data class Vec(public val x: Double, public val y: Double)

/** Turn a direction into one of 8 gaze directions (or center). The deadzone keeps small offsets still. */
public fun snapGaze(v: Vec, deadzone: Double = 0.3): Gaze {
    fun f(n: Double): Int = if (n > deadzone) 1 else if (n < -deadzone) -1 else 0
    return Gaze(f(v.x), f(v.y))
}

/** Which idle motion a body shape gets. Calm round shapes sway instead of bouncing. */
public fun motionFor(template: Template, energy: Int): Motion = when (template) {
    Template.Serpent, Template.Cobra, Template.Caterpillar -> Motion.Slither
    Template.Cloud, Template.Jelly -> Motion.Float
    Template.Capsule, Template.Twin, Template.Box, Template.Shield, Template.Hourglass -> Motion.Waddle
    Template.Star, Template.Gem, Template.Hex, Template.Kite, Template.Wedge -> Motion.Pulse
    else -> if (energy >= 45) Motion.Bounce else Motion.Sway
}

private val WANDER_GAZES = listOf(
    Gaze(-1, 0), Gaze(1, 0), Gaze(0, -1), Gaze(0, 1),
    Gaze(-1, -1), Gaze(1, -1), Gaze(-1, 1), Gaze(1, 1), Gaze(0, 0),
)

public class Behavior(
    seed: UInt,
    private val traits: Traits,
    /** The sprite's body shape. It decides how the mascot moves. */
    template: Template = Template.Blob,
    attention: AttentionMode = AttentionMode.Sometimes,
    /** No moving, no blinking, no wandering. Gaze still follows. */
    private val reducedMotion: Boolean = false,
    /** Idle time before sleeping. 0 never sleeps. */
    private val sleepAfterMs: Int = 30000,
) {
    private val rng = Rng(seed xor 0x9e3779b9u)
    private var mode = attention
    public val motion: Motion = motionFor(template, traits.energy)
    private val style = SpecData.motionStyles.getValue(motion.key)

    private val blinkMin = 4000 - traits.energy * 20
    private val stepMs = clamp(220 - traits.energy * 13 / 10, 100, 220)
    private val gazeDelay = 80 + (100 - traits.energy) * 2
    private val span = 3000 + (100 - traits.chaos) * 40

    private var now = 0
    private var lastActivity = 0
    private var asleep = false
    private var appMood: Mood? = null
    private var reactionMood: Mood? = null
    private var reactionUntil = 0
    private var reactionStart = 0
    private var target: Vec? = null
    private var focusTarget: Vec? = null
    public var attention: Attention = Attention.Follow
        private set
    private var wanderGaze = Gaze()
    private var wanderAt = 0
    private var gaze = Gaze()
    private var gazeAt = 0
    private var blinkUntil = -1
    public var mood: Mood = Mood.Neutral
        private set

    // Draw order matters: phase, attention span, first blink.
    private val phase = rng.int(stepMs * 8)
    private var attentionUntil = 0 + span + rng.int(3000)
    private var nextBlink = blinkMin + rng.int(1800)

    private fun touch() {
        lastActivity = now
        asleep = false
    }

    public fun setMood(m: Mood?) {
        appMood = m
        if (m != null) touch()
    }

    public fun react(m: Mood, ms: Int = 900) {
        reactionMood = m
        reactionStart = now
        reactionUntil = now + ms
        touch()
    }

    public fun clearReaction() {
        reactionMood = null
    }

    public fun lookAt(v: Vec?) {
        val t = target
        val moved = v != null && (t == null || kotlin.math.abs(v.x - t.x) + kotlin.math.abs(v.y - t.y) > 0.05)
        target = v
        if (moved) touch()
    }

    public fun focus(v: Vec?) {
        focusTarget = v
        if (v != null) touch()
    }

    public fun poke() {
        reactionMood = Mood.Surprised
        reactionStart = now
        reactionUntil = now + 700
        touch()
    }

    public fun setAttention(m: AttentionMode) {
        mode = m
    }

    private fun chooseAttention() {
        if (asleep) { attention = Attention.Asleep; return }
        if (focusTarget != null) { attention = Attention.Focus; return }
        // Nothing to follow, or told not to: just look around.
        if (mode == AttentionMode.Never || target == null) { attention = Attention.Wander; return }
        if (mode == AttentionMode.Always || reducedMotion) { attention = Attention.Follow; return }
        // Cursor present, mode sometimes: alternate between following and glancing away.
        if (attention != Attention.Follow && attention != Attention.Wander) {
            attention = Attention.Follow
            attentionUntil = now + span + rng.int(3000)
        } else if (now >= attentionUntil) {
            if (attention == Attention.Follow) {
                attention = Attention.Wander
                attentionUntil = now + 1500 + rng.int(2500)
                wanderAt = now
                wanderGaze = WANDER_GAZES[rng.int(WANDER_GAZES.size)]
            } else {
                attention = Attention.Follow
                attentionUntil = now + span + rng.int(3000)
            }
        }
    }

    /** Advance time by [dtMs] milliseconds and return the pose to draw. */
    public fun tick(dtMs: Int): Pose {
        now += maxOf(0, dtMs)
        if (sleepAfterMs > 0 && !asleep && appMood == null && now - lastActivity >= sleepAfterMs) asleep = true
        if (reactionMood != null && now >= reactionUntil) reactionMood = null

        chooseAttention()
        // While wandering, pick a new glance every couple of seconds.
        if (attention == Attention.Wander && !reducedMotion && now - wanderAt >= 1500 + traits.chaos * 20) {
            wanderAt = now
            wanderGaze = WANDER_GAZES[rng.int(WANDER_GAZES.size)]
        }

        if (now - gazeAt >= gazeDelay) {
            gazeAt = now
            val f = focusTarget
            val t = target
            gaze = when {
                attention == Attention.Asleep -> Gaze()
                attention == Attention.Focus && f != null -> snapGaze(f)
                attention == Attention.Follow && t != null -> snapGaze(t)
                attention == Attention.Wander && !reducedMotion -> wanderGaze
                else -> Gaze()
            }
        }

        mood = appMood ?: reactionMood ?: (if (asleep) Mood.Sleepy else Mood.Neutral)

        // Blinks come every two to four seconds, and one in four is a quick double blink.
        var blink = false
        if (!reducedMotion && mood != Mood.Sleepy) {
            if (now >= nextBlink) {
                blinkUntil = now + 140
                val double = rng.int(100)
                val gap = rng.int(1800)
                nextBlink = if (double < 25) now + 320 else now + blinkMin + gap
            }
            blink = now < blinkUntil
        }

        // Motion. Off for reduced motion; otherwise the shape's idle loop, unless the mood or a reaction says otherwise.
        var lift = 0
        var dx = 0
        var lean = 0
        var squash = 0
        var wave = 0
        var amp = 0
        if (!reducedMotion) {
            val step = (now + phase) / stepMs
            val i = step and 7
            val rm = reactionMood
            if (asleep || mood == Mood.Sleepy) {
                squash = SpecData.breatheSquash[((now + phase) / (stepMs * 3)) and 7]
            } else if (rm != null && (rm == Mood.Happy || rm == Mood.Surprised) && now - reactionStart < 800) {
                val k = (now - reactionStart) / 100
                lift = SpecData.jumpLift[k]
                squash = SpecData.jumpSquash[k]
            } else if (mood == Mood.Sad) {
                squash = 1 // droop
            } else {
                lift = style.lift[i]
                dx = style.dx[i]
                lean = style.lean[i]
                squash = style.squash[i]
                amp = style.amp
                wave = if (style.wave == "step") step and 7 else if (style.wave == "half") (step / 2) and 7 else 0
                if (mood == Mood.Thinking) lean = clamp(lean + 1, -3, 3)
            }
        }

        return Pose(mood, gaze, blink, lift, dx, lean, squash, wave, amp)
    }
}
