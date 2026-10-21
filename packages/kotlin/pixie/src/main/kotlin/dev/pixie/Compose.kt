package dev.pixie

// Spec: spec/sprite.md "Faces". Draws a mood onto the faceless body. Pure and integer-only.

private fun colorOf(ch: Char): Int = when (ch) {
    'k', 'p' -> Cell.INK
    'w' -> Cell.WHITE
    'a' -> Cell.ACCENT
    else -> Cell.INK
}

/** Returns a new grid: the sprite's body with the pose's face drawn on it. */
public fun compose(sprite: Sprite, pose: Pose = Pose()): IntArray {
    val mood = pose.mood
    val gx = pose.gaze.x
    val gy = pose.gaze.y
    val g = sprite.body.copyOf()
    val (eyeY, eyeInner, mouthY) = sprite.anchors

    // Eyes: the right eye mirrors the left; gaze moves both the same way.
    val pattern = SpecData.eyes[sprite.eyeStyle.key]?.get(if (pose.blink) "blink" else mood.key) ?: emptyList()
    val lx = AXIS - eyeInner - 5
    val rx = AXIS + 1 + eyeInner
    for (pupilPass in listOf(false, true)) {
        for ((i, row) in pattern.withIndex()) {
            for ((j, ch) in row.withIndex()) {
                if (ch == '.') continue
                val isPupil = ch == 'p'
                if (pupilPass != isPupil) continue
                val ox = if (isPupil) gx * 2 else 0
                val oy = if (isPupil) gy * 2 else 0
                val y = eyeY + i + oy
                for (x in listOf(lx + j + ox, rx + (row.length - 1 - j) + ox)) {
                    if (at(g, x, y) != 0) put(g, x, y, colorOf(ch))
                }
            }
        }
    }

    // Mouth, centered.
    val mouth = SpecData.mouths[mood.key] ?: emptyList()
    for ((i, row) in mouth.withIndex()) {
        val x0 = AXIS + 1 - row.length / 2
        for ((j, ch) in row.withIndex()) {
            if (ch != '.' && at(g, x0 + j, mouthY + i) != 0) put(g, x0 + j, mouthY + i, colorOf(ch))
        }
    }

    // Motion: squash and stretch, lean, wave, shift and lift, applied to the whole mascot (face included).
    val moved = applyMotion(g, pose)

    // Props float in the top-right corner in the accent color.
    SpecData.props[mood.key]?.let { prop ->
        for ((i, row) in prop.rows.withIndex()) {
            for ((j, ch) in row.withIndex()) if (ch != '.') put(moved, prop.x + j, prop.y + i, Cell.ACCENT)
        }
    }
    return moved
}

/** A sideways ripple, in columns, for eight rows in a row. Rows are offset by the wave phase. */
private val WAVE = intArrayOf(0, 1, 1, 0, 0, -1, -1, 0)

/**
 * Moves the whole picture. Integer only, so every platform agrees.
 * 1. squash > 0 presses the body shorter, < 0 stretches it taller, keeping its feet on the same row;
 * 2. each row is shifted sideways by lean (more at the top), the wave, and dx;
 * 3. everything is lifted by `lift` rows. The top rows are always empty, so nothing is lost.
 */
public fun applyMotion(g: IntArray, pose: Pose): IntArray {
    val squash = clamp(pose.squash, -3, 3)
    val lean = clamp(pose.lean, -3, 3)
    val dx = clamp(pose.dx, -3, 3)
    val lift = clamp(pose.lift, 0, MAX_LIFT)
    val amp = clamp(pose.amp, 0, 2)
    val wave = pose.wave and 7
    if (squash == 0 && lean == 0 && dx == 0 && lift == 0 && amp == 0) return g

    var top = -1
    var bot = -1
    run { for (y in 0 until SIZE) for (x in 0 until SIZE) if (g[y * SIZE + x] != 0) { top = y; return@run } }
    run { for (y in SIZE - 1 downTo 0) for (x in 0 until SIZE) if (g[y * SIZE + x] != 0) { bot = y; return@run } }
    if (top < 0) return g

    var cur = g
    if (squash != 0) {
        val h = bot - top + 1
        val nh = clamp(h - squash, 4, bot + 1) // cannot grow above the top of the picture
        val out = IntArray(SIZE * SIZE)
        for (i in 0 until nh) {
            val src = top + i * h / nh
            val dst = bot - (nh - 1) + i
            for (x in 0 until SIZE) out[dst * SIZE + x] = cur[src * SIZE + x]
        }
        cur = out
        top = bot - nh + 1
    }

    val span = maxOf(1, bot - top)
    val out = IntArray(SIZE * SIZE)
    for (y in top..bot) {
        val shift = lean * (bot - y) / span + WAVE[(y + wave) and 7] * amp + dx
        val ny = y - lift
        if (ny < 0) continue
        for (x in 0 until SIZE) {
            val v = cur[y * SIZE + x]
            val nx = x + shift
            if (v != 0 && nx in 0 until SIZE) out[ny * SIZE + nx] = v
        }
    }
    return out
}
