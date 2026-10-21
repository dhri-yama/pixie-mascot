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

    // Bob: shift everything up BOB rows. The top rows are always empty, so nothing is lost.
    if (pose.bob) {
        System.arraycopy(g, SIZE * BOB, g, 0, SIZE * (SIZE - BOB))
        for (i in SIZE * (SIZE - BOB) until SIZE * SIZE) g[i] = 0
    }

    // Props float in the top-right corner in the accent color.
    SpecData.props[mood.key]?.let { prop ->
        for ((i, row) in prop.rows.withIndex()) {
            for ((j, ch) in row.withIndex()) if (ch != '.') put(g, prop.x + j, prop.y + i, Cell.ACCENT)
        }
    }
    return g
}
