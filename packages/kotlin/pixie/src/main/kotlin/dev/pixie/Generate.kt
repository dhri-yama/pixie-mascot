package dev.pixie

// Spec: spec/sprite.md. Text -> Sprite. Pure function of (text, version, palette preset).
// The order of rng draws is part of the algorithm: it must match the TypeScript core exactly.

private class PartRolls(val present: Int, val tone: Int, val part: Long, val dx: Long, val row: Long)

private val PART_VALUE = mapOf('#' to Cell.BODY, 'a' to Cell.ACCENT, 'd' to Cell.SHADE, 'l' to Cell.LIGHT)

private fun topOf(g: IntArray, x: Int): Int {
    for (y in 0 until SIZE) if (at(g, x, y) != 0) return y
    return -1
}

private fun bottomOf(g: IntArray, x: Int): Int {
    for (y in SIZE - 1 downTo 0) if (at(g, x, y) != 0) return y
    return -1
}

private fun leftOf(g: IntArray, y: Int): Int {
    for (x in 0 until SIZE) if (at(g, x, y) != 0) return x
    return -1
}

private fun putIfEmpty(g: IntArray, x: Int, y: Int, v: Int) {
    if (at(g, x, y) == 0) put(g, x, y, v)
}

private fun bodyCell(t: Template, c: Int, r: Int, half: Int, bh: Int, k: Int, halfTop: Int): Boolean {
    val bw = half * 2
    val dx = (half - c) * 2 - 1
    val dy = 2 * r + 1 - bh
    return when (t) {
        Template.Blob -> dx * dx * bh * bh + dy * dy * bw * bw <= bw * bw * bh * bh
        Template.Gem -> dx * bh + kotlin.math.abs(dy) * bw <= bw * bh
        Template.Box -> c + minOf(r, bh - 1 - r) >= k || c >= k || minOf(r, bh - 1 - r) >= k
        Template.Wedge -> half - c <= halfTop + (half - halfTop) * r / (bh - 1)
    }
}

private fun placePart(g: IntArray, part: PartDef, rolls: PartRolls, y0: Int, bh: Int, half: Int) {
    val h = part.rows.size
    val w = part.rows[0].length
    fun cell(i: Int, j: Int): Int {
        val row = part.rows.getOrNull(i) ?: return 0
        if (j >= row.length) return 0
        return PART_VALUE[row[j]] ?: 0
    }
    val xl = 8 - half

    when (part.slot) {
        "top" -> {
            val dx = part.dx[(rolls.dx % part.dx.size).toInt()]
            val ax = 7 - dx
            if (ax < xl || topOf(g, ax) < 0) return
            val yb = topOf(g, ax) - 1
            for (i in 0 until h) {
                val y = yb - (h - 1) + i
                if (y < 2) continue
                for (j in 0 until w) {
                    val x = ax - (w - 1) + j
                    val v = cell(i, j)
                    if (v != 0 && x >= 1) putIfEmpty(g, x, y, v)
                }
            }
            // Roots: stretch each column down to the body so nothing floats.
            for (j in 0 until w) {
                val x = ax - (w - 1) + j
                var lowest = -1
                for (i in 0 until h) if (cell(i, j) != 0 && yb - (h - 1) + i >= 2) lowest = yb - (h - 1) + i
                if (lowest < 0 || x < 1) continue
                var y = lowest + 1
                var n = 0
                while (y < SIZE && n < 4 && at(g, x, y) == 0) {
                    put(g, x, y, Cell.BODY)
                    y++; n++
                }
            }
        }
        "side" -> {
            val ys = y0 + 2 + (rolls.row % maxOf(1, bh - 3)).toInt()
            val lx = leftOf(g, ys)
            if (lx < 0) return
            val xr = lx - 1
            if (xr - (w - 1) < 1) return
            for (i in 0 until h) {
                for (j in 0 until w) {
                    val v = cell(i, j)
                    if (v != 0) putIfEmpty(g, xr - (w - 1) + j, ys + i, v)
                }
                // Reach back to the body on this row.
                var rightmost = -1
                for (j in 0 until w) if (cell(i, j) != 0) rightmost = xr - (w - 1) + j
                var x = rightmost + 1
                var n = 0
                while (rightmost >= 0 && x <= 7 && n < 3 && at(g, x, ys + i) == 0) {
                    put(g, x, ys + i, Cell.BODY)
                    x++; n++
                }
            }
        }
        else -> {
            val dx = part.dx[(rolls.dx % part.dx.size).toInt()]
            val ax = 7 - dx
            if (ax < xl) return
            val yb = bottomOf(g, ax)
            if (yb < 0) return
            for (i in 0 until h) {
                val y = yb + 1 + i
                if (y > 14) continue
                for (j in 0 until w) {
                    val x = ax - (w - 1) + j
                    val v = cell(i, j)
                    if (v != 0 && x >= 1) putIfEmpty(g, x, y, v)
                }
            }
            // Stretch each column up to the body.
            for (j in 0 until w) {
                val x = ax - (w - 1) + j
                var top = -1
                for (i in h - 1 downTo 0) if (cell(i, j) != 0 && yb + 1 + i <= 14) top = yb + 1 + i
                if (top < 0 || x < 1) continue
                var y = top - 1
                var n = 0
                while (y >= 0 && n < 3 && at(g, x, y) == 0) {
                    put(g, x, y, Cell.BODY)
                    y--; n++
                }
            }
        }
    }
}

private fun pickPart(slot: String, wantSoft: Boolean, rolls: PartRolls, chaos: Int): PartDef? {
    val flip = rolls.tone < 20 + chaos / 5
    val soft = if (flip) !wantSoft else wantSoft
    val pool = SpecData.parts.filter { it.slot == slot && it.tone == (if (soft) "soft" else "sharp") }
    if (pool.isEmpty()) return null
    return pool[(rolls.part % pool.size).toInt()]
}

/** Widest eye spacing (at most [pref], at least 1) whose left eye sits fully on the body. */
private fun fitEyes(fill: IntArray, style: EyeStyle, eyeY0: Int, pref: Int): Pair<Int, Int> {
    val offsets = if (style == EyeStyle.Big) listOf(0, 1, 2) else listOf(1, 2)
    for (margin in listOf(1, 0)) {
        for (dy in 0..2) {
            for (ei in pref downTo 1) {
                val lx = 7 - ei - 2
                var ok = true
                for (r in offsets) {
                    for (c in offsets) if (at(fill, lx + c, eyeY0 + dy + r) == 0) ok = false
                    if (margin == 1 && at(fill, lx + offsets[0] - 1, eyeY0 + dy + r) == 0) ok = false
                }
                if (ok) return Pair(eyeY0 + dy, ei)
            }
        }
    }
    return Pair(eyeY0, 1)
}

/** Text -> mascot. Same normalized text, version and palette always give the same sprite. */
public fun generate(text: String, version: Int = VERSION, palette: Preset? = null): Sprite {
    require(version == VERSION) { "Unsupported Pixie algorithm version: $version" }

    val norm = normalize(text)
    val seed = hashText(norm)
    val rng = Rng(seed)

    val traits = computeTraits(norm, rng)
    val roundness = traits.roundness
    val heft = traits.heft
    val energy = traits.energy
    val chaos = traits.chaos

    // Body shape.
    val eff = clamp(roundness + (rng.int(15) - 7))
    val heightRoll = rng.int(2)
    val chamferRoll = rng.int(2)
    val wedgeRoll = rng.int(2)
    val template = if (eff >= 68) Template.Blob else if (eff >= 45) Template.Box else if (eff >= 25) Template.Wedge else Template.Gem
    val sizeIdx = if (heft < 34) 0 else if (heft < 67) 1 else 2
    val half = 4 + sizeIdx
    val bh = intArrayOf(9, 8, 7)[sizeIdx] - heightRoll
    val y0 = 13 - bh
    val xl = 8 - half
    val k = 1 + chamferRoll
    val halfTop = minOf(half, 1 + wedgeRoll)

    val g = IntArray(SIZE * SIZE)
    for (r in 0 until bh) {
        for (c in 0 until half) {
            if (bodyCell(template, c, r, half, bh, k, halfTop)) put(g, xl + c, y0 + r, Cell.BODY)
        }
    }

    // Parts. Every slot always draws the same five numbers.
    fun draw() = PartRolls(rng.int(100), rng.int(100), rng.next().toLong(), rng.next().toLong(), rng.next().toLong())
    val rTop = draw()
    val rSide = draw()
    val rBottom = draw()
    val rTop2 = draw()
    val wantSoft = eff >= 50
    val plan = listOf(
        Triple("top", rTop, 70),
        Triple("side", rSide, 30 + energy / 3),
        Triple("bottom", rBottom, 80),
        Triple("top", rTop2, if (energy >= 60) 60 else 0),
    )
    for ((slot, rolls, chance) in plan) {
        if (rolls.present >= chance) continue
        pickPart(slot, wantSoft, rolls, chaos)?.let { placePart(g, it, rolls, y0, bh, half) }
    }

    // Mirror left half onto the right half.
    for (y in 0 until SIZE) for (x in 0 until 8) put(g, 15 - x, y, at(g, x, y))

    // Chaos breaks symmetry.
    val mutations = chaos / 25
    for (m in 0 until mutations) {
        val typeRoll = rng.next().toLong()
        val pickRoll = rng.next().toLong()
        val cands = ArrayList<Int>()
        val chip = typeRoll % 2 == 0L
        for (y in 2 until 15) {
            for (x in 8 until 16) {
                val v = at(g, x, y)
                if (chip) {
                    val edge = at(g, x - 1, y) == 0 || at(g, x + 1, y) == 0 || at(g, x, y - 1) == 0 || at(g, x, y + 1) == 0
                    if (v == Cell.BODY && edge && at(g, x, y - 1) == 0) cands.add(y * SIZE + x)
                } else if (v == 0 && at(g, x, y + 1) == Cell.BODY && at(g, x, y - 1) == 0) {
                    cands.add(y * SIZE + x)
                }
            }
        }
        if (cands.isNotEmpty()) g[cands[(pickRoll % cands.size).toInt()]] = if (chip) Cell.CLEAR else Cell.BODY
    }

    // Shade bottoms, one highlight pixel, then outline. Each pass reads a snapshot.
    val snap1 = g.copyOf()
    for (y in 0 until SIZE) {
        for (x in 0 until SIZE) {
            if (at(snap1, x, y) == Cell.BODY && at(snap1, x, y + 1) == 0) put(g, x, y, Cell.SHADE)
        }
    }
    scan@ for (y in 0 until SIZE) {
        for (x in 0 until SIZE) {
            if (at(g, x, y) == Cell.BODY && at(g, x + 1, y) == Cell.BODY && at(g, x, y + 1) == Cell.BODY && at(g, x - 1, y) != 0) {
                put(g, x, y, Cell.LIGHT)
                break@scan
            }
        }
    }
    val snap2 = g.copyOf()
    for (y in 0 until SIZE) {
        for (x in 0 until SIZE) {
            if (at(snap2, x, y) != 0) continue
            if (at(snap2, x - 1, y) != 0 || at(snap2, x + 1, y) != 0 || at(snap2, x, y - 1) != 0 || at(snap2, x, y + 1) != 0) {
                put(g, x, y, Cell.OUTLINE)
            }
        }
    }

    // Face anchors.
    val eyeInnerRoll = rng.int(2)
    val eyeStyleRoll = rng.int(40)
    val eyeStyle = if (clamp(roundness + eyeStyleRoll - 20) >= 50) EyeStyle.Big else EyeStyle.Dot
    val (fitY, fitInner) = fitEyes(snap2, eyeStyle, y0 + bh * 30 / 100 + (if (template == Template.Gem) 1 else 0), 1 + eyeInnerRoll + (if (half == 6) 1 else 0))
    val anchors = Anchors(fitY, fitInner, minOf(fitY + 4, y0 + bh - 2))

    // Colors.
    val entryRoll = rng.next().toLong()
    val pool = if (energy >= 60) SpecData.vivid else if (roundness >= 50) SpecData.pastel else SpecData.deep
    val entry = pool[(entryRoll % pool.size).toInt()]
    var colors = listOf("", entry.body, entry.outline, entry.shade, entry.light, entry.accent, entry.outline, SpecData.white)
    var colorName = entry.name
    if (palette != null) {
        val p = SpecData.presets.getValue(palette.key)
        colors = listOf("", p[2], p[0], p[1], p[3], p[2], p[0], p[3])
        colorName = palette.key
    }

    val sprite = Sprite(version, seed, norm, traits, template, eyeStyle, anchors, g, colors, colorName)
    sprite.grid = compose(sprite, Pose())
    return sprite
}
