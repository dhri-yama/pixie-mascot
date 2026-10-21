package dev.pixie

// Spec: spec/sprite.md. Text -> Sprite. Pure function of (text, version, palette preset).
// The order of rng draws is part of the algorithm: it must match the TypeScript core exactly.
//
// Geometry (32x32 grid): the left half is columns 0..15 and is mirrored onto 16..31. The body sits on the
// ground (its last row is 25), feet use rows 26..29, row 30 is outline. Rows 0..3 are kept free for parts
// that stick up, the outline above them, and lifting. A tail is drawn after mirroring, on the right only.

private class PartRolls(val present: Int, val tone: Int, val part: Long, val dx: Long, val row: Long)

private val PART_VALUE = mapOf('#' to Cell.BODY, 'a' to Cell.ACCENT, 'd' to Cell.SHADE, 'l' to Cell.LIGHT)

/**
 * Body shapes. Round-sounding text picks from the soft list, sharp-sounding text from the sharp list, and text
 * full of hissing, slithering letters (s z x h w y l) often picks from the sinuous list: snakes and worms.
 */
private val SOFT = listOf(
    Template.Blob, Template.Egg, Template.Pear, Template.Capsule, Template.Dome, Template.Cloud, Template.Twin, Template.Box,
    Template.Mushroom, Template.Bell, Template.Drop, Template.Jelly,
)
private val SHARP = listOf(Template.Star, Template.Gem, Template.Wedge, Template.Hex, Template.Kite, Template.Shield, Template.Hourglass)
private val SINUOUS = listOf(Template.Serpent, Template.Cobra, Template.Caterpillar)

/** Where the eyes start, as a percent of the body height. */
private val EYE_PCT = mapOf(
    Template.Blob to 30, Template.Egg to 30, Template.Pear to 25, Template.Capsule to 25, Template.Dome to 35,
    Template.Cloud to 35, Template.Twin to 0, Template.Box to 30, Template.Mushroom to 25, Template.Bell to 45,
    Template.Drop to 50, Template.Jelly to 25, Template.Star to 40, Template.Gem to 40, Template.Wedge to 45,
    Template.Hex to 30, Template.Kite to 40, Template.Shield to 25, Template.Hourglass to 15, Template.Serpent to 0,
    Template.Cobra to 10, Template.Caterpillar to 8,
)

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

private fun rightOf(g: IntArray, y: Int): Int {
    for (x in SIZE - 1 downTo 0) if (at(g, x, y) != 0) return x
    return -1
}

private fun putIfEmpty(g: IntArray, x: Int, y: Int, v: Int) {
    if (at(g, x, y) == 0) put(g, x, y, v)
}

/** Integer square root, floor. Exact for the small numbers used here. */
private fun isqrt(n: Int): Int {
    if (n <= 0) return 0
    var r = Math.sqrt(n.toDouble()).toInt()
    while (r * r > n) r--
    while ((r + 1) * (r + 1) <= n) r++
    return r
}

/** Half width, in cells, of row r of an ellipse that is [hw] cells wide on each side and [h] rows tall. */
private fun ellipseHw(r: Int, hw: Int, h: Int): Int {
    val t = 2 * r + 1 - h
    return (hw * isqrt(h * h - t * t) * 2 + h) / (2 * h)
}

/** Half width of row i (from the end) of a round cap of radius ra. */
private fun capHw(i: Int, ra: Int): Int = (isqrt((2 * i + 1) * (4 * ra - 2 * i - 1)) + 1) / 2

/** Widest of several ellipses stacked down the body. Each is (first row, height, half width). */
private fun stackHw(r: Int, segs: List<Triple<Int, Int, Int>>): Int {
    var v = 0
    for ((start, h, w) in segs) if (r >= start && r < start + h) v = maxOf(v, ellipseHw(r - start, w, h))
    return v
}

/** Half width in cells for every body row. Each shape is a different silhouette; widths are clamped to 1..half. */
private fun rowWidths(t: Template, half: Int, bh: Int, k: Int, halfTop: Int): IntArray {
    val w = IntArray(bh)
    fun mid(r: Int): Int = kotlin.math.abs(2 * r + 1 - bh) * half / bh // distance from the middle row, in cells
    val sq = half * 55 / 100
    for (r in 0 until bh) {
        val v: Int = when (t) {
            Template.Blob -> ellipseHw(r, half, bh)
            Template.Egg -> ellipseHw(r, half, bh) * (65 + 35 * r / (bh - 1)) / 100
            Template.Pear -> ellipseHw(r, half, bh) * (30 + 70 * r / (bh - 1)) / 100
            Template.Capsule -> {
                val ra = minOf(half, bh / 2)
                if (r < ra) half - ra + capHw(r, ra) else if (r >= bh - ra) half - ra + capHw(bh - 1 - r, ra) else half
            }
            Template.Dome -> {
                val tt = maxOf(4, bh * 60 / 100)
                if (r < tt) (half * isqrt((2 * r + 1) * (4 * tt - 2 * r - 1)) + tt) / (2 * tt) else half
            }
            Template.Cloud -> {
                val tt = maxOf(4, bh * 70 / 100)
                if (r < tt) (half * isqrt((2 * r + 1) * (4 * tt - 2 * r - 1)) + tt) / (2 * tt) else half
            }
            Template.Twin -> {
                val rh = maxOf(5, half * 70 / 100)
                val hh = minOf(bh - 6, 2 * rh)
                val s = hh - 2
                val head = if (r < hh) ellipseHw(r, rh, hh) else 0
                val body = if (r >= s) ellipseHw(r - s, half, bh - s) else 0
                maxOf(head, body)
            }
            Template.Box -> half - maxOf(0, k - minOf(r, bh - 1 - r))
            Template.Star -> {
                val d = mid(r)
                maxOf(if (d <= sq) sq else 0, half - d)
            }
            Template.Gem -> half - mid(r)
            Template.Wedge -> halfTop + (half - halfTop) * r / (bh - 1)
            Template.Hex -> {
                val q = maxOf(2, bh / 3)
                if (r < q) half * (r + 1) / q else if (r >= bh - q) half * (bh - r) / q else half
            }
            Template.Kite -> {
                val s = maxOf(3, bh * 35 / 100)
                if (r < s) half * (r + 1) / s else half * (bh - r) / (bh - s)
            }
            Template.Mushroom -> {
                val tt = maxOf(4, bh * 55 / 100)
                if (r < tt) (half * isqrt((2 * r + 1) * (4 * tt - 2 * r - 1)) + tt) / (2 * tt) else maxOf(3, half * 40 / 100)
            }
            Template.Jelly -> {
                val tt = maxOf(4, bh * 55 / 100)
                if (r < tt) (half * isqrt((2 * r + 1) * (4 * tt - 2 * r - 1)) + tt) / (2 * tt) else half * 85 / 100
            }
            Template.Bell -> {
                val q = 100 * r / (bh - 1)
                half * (30 + 70 * q * q / 10000) / 100
            }
            Template.Drop -> {
                val s = maxOf(3, bh * 45 / 100)
                if (r < s) half * (r + 1) * (r + 1) / ((s + 1) * (s + 1)) else ellipseHw(bh - s + (r - s), half, 2 * (bh - s))
            }
            Template.Shield -> {
                val s = bh * 55 / 100
                if (r < s) half - maxOf(0, 2 - r) else half * (bh - r) / (bh - s)
            }
            Template.Hourglass -> half * (35 + 65 * kotlin.math.abs(2 * r + 1 - bh) / bh) / 100
            Template.Cobra -> {
                val b0 = bh * 42 / 100
                val b1 = bh * 66 / 100
                stackHw(r, listOf(
                    Triple(0, maxOf(5, bh * 40 / 100), half), // hood
                    Triple(bh * 30 / 100, maxOf(3, bh * 20 / 100 + 1), maxOf(3, half * 30 / 100)), // neck
                    Triple(b0, maxOf(4, bh * 30 / 100), half * 80 / 100), // first coil
                    Triple(b1, bh - b1, half * 95 / 100), // second coil
                ))
            }
            Template.Caterpillar -> {
                val h = bh * 34 / 100 + 1
                stackHw(r, listOf(
                    Triple(0, h, maxOf(6, half * 70 / 100)), // head
                    Triple(bh * 22 / 100, h, half * 85 / 100),
                    Triple(bh * 44 / 100, h, half),
                    Triple(bh * 66 / 100, h, half * 75 / 100),
                ))
            }
            Template.Serpent -> 1 // drawn from circles instead, see serpentCells
        }
        w[r] = clamp(v, 1, half)
    }
    return w
}

/** One period of a sine wave in sixteenths, 32 steps. Used for the coils of a snake. */
private val SIN32 = intArrayOf(0, 3, 6, 9, 11, 13, 15, 16, 16, 16, 15, 13, 11, 9, 6, 3, 0, -3, -6, -9, -11, -13, -15, -16, -16, -16, -15, -13, -11, -9, -6, -3)

/** Fill a circle of radius r (in cells) centered on cell row cy, at doubled column c2x. */
private fun stamp(g: IntArray, c2x: Int, cy: Int, r: Int) {
    val c2y = 2 * cy + 1
    for (y in cy - r - 1..cy + r + 1) {
        for (x in 0 until SIZE) {
            val dx = 2 * x + 1 - c2x
            val dy = 2 * y + 1 - c2y
            if (dx * dx + dy * dy <= 4 * r * r) put(g, x, y, Cell.BODY)
        }
    }
}

/**
 * A coiled snake: a round head on a short neck, resting on two stacked ring-shaped coils with holes you can see
 * through. Built from a chain of circles along two ellipses. Not mirrored from a half. Returns the head radius.
 */
private fun serpentCells(g: IntArray, y0: Int): Int {
    val r0 = 5 // head radius
    stamp(g, SIZE, y0 + r0, r0)
    stamp(g, SIZE, y0 + r0 + 1, r0 - 1)
    for (cy in y0 + r0 + 3..y0 + r0 + 5) stamp(g, SIZE, cy, 2) // neck
    fun coil(cy: Int, rx: Int, ry: Int) {
        for (j in 0 until 32) stamp(g, SIZE + 2 * (rx * SIN32[(j + 8) and 31] / 16), cy + ry * SIN32[j] / 16, 2)
    }
    coil(GROUND - 10, 8, 3) // upper coil
    coil(GROUND - 4, 12, 4) // lower, wider coil
    return r0
}

private fun placePart(g: IntArray, part: PartDef, rolls: PartRolls, y0: Int, bh: Int, half: Int) {
    val h = part.rows.size
    val w = part.rows[0].length
    fun cell(i: Int, j: Int): Int {
        val row = part.rows.getOrNull(i) ?: return 0
        if (j >= row.length) return 0
        return PART_VALUE[row[j]] ?: 0
    }
    val xl = AXIS + 1 - half

    when (part.slot) {
        "top" -> {
            // Slide inward until body lies under every column of the part (narrow tops, stars, snakes...), else skip it.
            var ax = maxOf(xl, AXIS - part.dx[(rolls.dx % part.dx.size).toInt()])
            while (ax < AXIS && (topOf(g, ax) < 0 || topOf(g, ax - (w - 1)) < 0)) ax++
            if (topOf(g, ax) < 0 || topOf(g, ax - (w - 1)) < 0) return
            val yb = topOf(g, ax) - 1
            for (i in 0 until h) {
                val y = yb - (h - 1) + i
                if (y < TOP) continue
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
                for (i in 0 until h) if (cell(i, j) != 0 && yb - (h - 1) + i >= TOP) lowest = yb - (h - 1) + i
                if (lowest < 0 || x < 1) continue
                var y = lowest + 1
                var n = 0
                while (y < SIZE && n < 8 && at(g, x, y) == 0) {
                    put(g, x, y, Cell.BODY)
                    y++; n++
                }
            }
        }
        "side" -> {
            val ys = y0 + 4 + (rolls.row % maxOf(1, bh - 8)).toInt()
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
                while (rightmost >= 0 && x <= AXIS && n < 6 && at(g, x, ys + i) == 0) {
                    put(g, x, ys + i, Cell.BODY)
                    x++; n++
                }
            }
        }
        "bottom" -> {
            var ax = maxOf(xl, AXIS - part.dx[(rolls.dx % part.dx.size).toInt()])
            while (ax < AXIS && (bottomOf(g, ax) < 0 || bottomOf(g, ax - (w - 1)) < 0)) ax++
            val yb = bottomOf(g, ax)
            if (yb < 0 || bottomOf(g, ax - (w - 1)) < 0) return
            for (i in 0 until h) {
                val y = yb + 1 + i
                if (y > GROUND + 4) continue
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
                for (i in h - 1 downTo 0) if (cell(i, j) != 0 && yb + 1 + i <= GROUND + 4) top = yb + 1 + i
                if (top < 0 || x < 1) continue
                var y = top - 1
                var n = 0
                while (y >= 0 && n < 6 && at(g, x, y) == 0) {
                    put(g, x, y, Cell.BODY)
                    y--; n++
                }
            }
        }
        else -> {
            // Tail: right side only. The bottom row sits on a body row in the lower half; the first column touches the body.
            val ys = y0 + bh * 55 / 100 + (rolls.row % maxOf(1, bh * 30 / 100)).toInt()
            val rx = rightOf(g, ys)
            if (rx < 0) return
            val x0 = rx + 1
            for (i in 0 until h) {
                val y = ys - (h - 1) + i
                if (y < TOP) continue
                for (j in 0 until w) {
                    val v = cell(i, j)
                    if (v != 0 && x0 + j < SIZE - 1) putIfEmpty(g, x0 + j, y, v)
                }
                // Reach back to the body on this row.
                var leftmost = -1
                for (j in w - 1 downTo 0) if (cell(i, j) != 0) leftmost = x0 + j
                var x = leftmost - 1
                var n = 0
                while (leftmost >= 0 && x >= AXIS + 1 && n < 6 && at(g, x, y) == 0) {
                    put(g, x, y, Cell.BODY)
                    x--; n++
                }
            }
        }
    }
}

/** Snakes are plain coils with at most a tail, cobras are plain, caterpillars get feelers and feet; everything else can have every part. */
private fun allows(t: Template, slot: String): Boolean {
    if (t == Template.Serpent) return slot == "tail"
    if (t == Template.Cobra) return false
    if (t == Template.Caterpillar) return slot == "top" || slot == "bottom"
    return true
}

private fun pickPart(slot: String, wantSoft: Boolean, rolls: PartRolls, chaos: Int): PartDef? {
    val flip = rolls.tone < 20 + chaos / 5
    val soft = if (flip) !wantSoft else wantSoft
    val pool = SpecData.parts.filter { it.slot == slot && it.tone == (if (soft) "soft" else "sharp") }
    if (pool.isEmpty()) return null
    return pool[(rolls.part % pool.size).toInt()]
}

/**
 * Widest eye spacing (at most [pref], at least 1) whose left eye sits fully on the body, moving the eyes
 * down up to four rows when the body is too narrow. The eye box is 6x6; a "dot" eye needs its lower-right 4x4.
 */
private fun fitEyes(fill: IntArray, style: EyeStyle, eyeY0: Int, pref: Int): Pair<Int, Int> {
    val offsets = if (style == EyeStyle.Big) listOf(0, 1, 2, 3, 4, 5) else listOf(2, 3, 4, 5)
    for (margin in listOf(1, 0)) {
        for (dy in 0..4) {
            for (ei in pref downTo 1) {
                val lx = AXIS - ei - 5
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

    // Body shape and proportions.
    val eff = clamp(roundness + (rng.int(15) - 7))
    val familyRoll = rng.int(100)
    val shapeRoll = rng.int(1000)
    val heightRoll = rng.int(3)
    val stretchRoll = rng.int(5)
    val widthRoll = rng.int(3)
    val leanRoll = rng.int(61) - 30
    val chamferRoll = rng.int(3)
    val wedgeRoll = rng.int(3)
    // Hissing, slithering letters often make a snake or worm; a few other texts get one by chance.
    val sinuous = (traits.slink >= 30 && familyRoll < 70) || familyRoll < 4
    val list = if (sinuous) SINUOUS else if (eff >= 50) SOFT else SHARP
    val template = list[shapeRoll % list.size]
    // Heft says wide or tall, but a roll of its own keeps heavy-sounding words from all being flat blobs.
    // Pointy shapes cover less area, so they are drawn a little bigger.
    val lean = clamp(heft + leanRoll)
    val grow = if (template == Template.Star || template == Template.Gem || template == Template.Kite || template == Template.Hex) 2 else if (template == Template.Wedge) 1 else 0
    val half = clamp(7 + lean * 6 / 100 + widthRoll - 1 + grow, 7, 13) // 7..13 columns on the left side
    // A snake fills the whole height; everything else is 10..18 rows tall.
    val bh = if (template == Template.Serpent) GROUND - TOP + 1 else clamp(18 - lean * 7 / 100 - heightRoll + stretchRoll - 2, 10, 18)
    val y0 = GROUND - bh + 1
    val xl = AXIS + 1 - half
    val k = 2 + chamferRoll // chamfer size of the box
    val halfTop = minOf(half, 3 + wedgeRoll) // half width at the top of the wedge

    val g = IntArray(SIZE * SIZE)
    // The head of a serpent is a circle, so its eyes have less room than a body of the same width.
    var eyeRoom = half
    var serpentHead = 0
    if (template == Template.Serpent) {
        serpentHead = serpentCells(g, y0)
        eyeRoom = serpentHead
    } else {
        val widths = rowWidths(template, half, bh, k, halfTop)
        val jellyTop = maxOf(4, bh * 55 / 100)
        for (r in 0 until bh) {
            for (c in 0 until half) {
                // The cloud's lower edge is scalloped: every other group of three columns is three rows shorter.
                if (template == Template.Cloud && r >= bh - (if (c % 6 < 3) 0 else 3)) continue
                // A jellyfish keeps only thin strands of different lengths under its dome.
                if (template == Template.Jelly && r >= jellyTop && !(c % 4 == 1 && r < bh - ((c * 5) % 4))) continue
                if (half - c <= widths[r]) {
                    put(g, xl + c, y0 + r, Cell.BODY)
                    put(g, SIZE - 1 - (xl + c), y0 + r, Cell.BODY)
                }
            }
        }
    }
    val bodyOnly = g.copyOf()

    // Parts. Every slot always draws the same five numbers.
    fun draw() = PartRolls(rng.int(100), rng.int(100), rng.next().toLong(), rng.next().toLong(), rng.next().toLong())
    val rTop = draw()
    val rSide = draw()
    val rBottom = draw()
    val rTop2 = draw()
    val rTail = draw()
    val wantSoft = eff >= 50
    val plan = listOf(
        Triple("top", rTop, 70),
        Triple("side", rSide, 30 + energy / 3),
        Triple("bottom", rBottom, 80),
        Triple("top", rTop2, if (energy >= 60) 60 else 0),
    )
    for ((slot, rolls, chance) in plan) {
        if (rolls.present >= chance || !allows(template, slot)) continue
        pickPart(slot, wantSoft, rolls, chaos)?.let { placePart(g, it, rolls, y0, bh, half) }
    }

    // Mirror the parts (placed on the left half) onto the right half. The body already has both sides.
    for (y in 0 until SIZE) {
        for (x in 0..AXIS) {
            if (g[y * SIZE + x] != bodyOnly[y * SIZE + x]) put(g, SIZE - 1 - x, y, at(g, x, y))
        }
    }

    // Marks. One decoration per mascot; always draw the same seven numbers. They only ever paint body pixels.
    val markRoll = rng.int(100)
    val mr = LongArray(6) { rng.next().toLong() }
    val mark = if (markRoll < 25) Mark.None else if (markRoll < 45) Mark.Belly else if (markRoll < 60) Mark.Spots else if (markRoll < 72) Mark.Stripes else if (markRoll < 88) Mark.Cheeks else Mark.Gem
    if (mark == Mark.Belly) {
        val rc = y0 + bh * 68 / 100
        val hh = maxOf(2, bh * 22 / 100)
        val hwb = maxOf(3, half * 55 / 100)
        for (y in rc - hh..rc + hh) {
            for (x in 0 until SIZE) {
                val dxc = if (x <= AXIS) AXIS + 1 - x else x - AXIS
                val dyy = y - rc
                if (dxc * dxc * hh * hh + dyy * dyy * hwb * hwb <= hwb * hwb * hh * hh && at(g, x, y) == Cell.BODY) put(g, x, y, Cell.LIGHT)
            }
        }
    } else if (mark == Mark.Spots) {
        for (i in 0 until 3) {
            val x = xl + 2 + (mr[2 * i] % maxOf(1, half - 5)).toInt()
            val y = y0 + 3 + (mr[2 * i + 1] % maxOf(1, bh - 8)).toInt()
            for (sx in listOf(x, SIZE - 2 - x)) {
                if (at(g, sx, y) == Cell.BODY && at(g, sx + 1, y) == Cell.BODY && at(g, sx, y + 1) == Cell.BODY && at(g, sx + 1, y + 1) == Cell.BODY) {
                    put(g, sx, y, Cell.SHADE)
                    put(g, sx + 1, y, Cell.SHADE)
                    put(g, sx, y + 1, Cell.SHADE)
                    put(g, sx + 1, y + 1, Cell.SHADE)
                }
            }
        }
    } else if (mark == Mark.Stripes) {
        val bands = 2 + (mr[0] % 2).toInt()
        val gap = 2 + (mr[1] % 2).toInt()
        for (b in 0 until bands) {
            val yy = y0 + 3 + b * (2 + gap)
            for (dy in 0 until 2) {
                for (x in 0 until SIZE) if (at(g, x, yy + dy) == Cell.BODY) put(g, x, yy + dy, Cell.SHADE)
            }
        }
    }

    // A tail grows on the right side only, so it is the one thing that is not mirrored.
    if (rTail.present < 25 + chaos / 4 + energy / 5 && allows(template, "tail")) {
        pickPart("tail", wantSoft, rTail, chaos)?.let { placePart(g, it, rTail, y0, bh, half) }
    }

    // Chaos breaks symmetry.
    val mutations = chaos / 25
    for (m in 0 until mutations) {
        val typeRoll = rng.next().toLong()
        val pickRoll = rng.next().toLong()
        val cands = ArrayList<Int>()
        val chip = typeRoll % 2 == 0L
        for (y in TOP until GROUND + 5) {
            for (x in AXIS + 1 until SIZE) {
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

    // Shade the bottom two rows of every downward-facing edge, add a three-pixel shine, then outline.
    // Each pass reads a snapshot.
    val snap1 = g.copyOf()
    for (y in 0 until SIZE) {
        for (x in 0 until SIZE) {
            if (at(snap1, x, y) == Cell.BODY && (at(snap1, x, y + 1) == 0 || at(snap1, x, y + 2) == 0)) put(g, x, y, Cell.SHADE)
        }
    }
    scan@ for (y in 0 until SIZE) {
        for (x in 0 until SIZE) {
            if (at(g, x, y) == Cell.BODY && at(g, x + 1, y) == Cell.BODY && at(g, x + 2, y) == Cell.BODY &&
                at(g, x, y + 1) == Cell.BODY && at(g, x + 1, y + 1) == Cell.BODY && at(g, x, y + 2) == Cell.BODY &&
                at(g, x - 1, y) != 0
            ) {
                put(g, x, y, Cell.LIGHT)
                put(g, x + 1, y, Cell.LIGHT)
                put(g, x, y + 1, Cell.LIGHT)
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

    // Face anchors. Narrow bodies cannot hold the big 6x6 eyes, so they get the small ones.
    val eyeInnerRoll = rng.int(3)
    val eyeStyleRoll = rng.int(40)
    val eyeStyle = if (clamp(roundness + eyeStyleRoll - 20) >= 50 && eyeRoom >= 9) EyeStyle.Big else EyeStyle.Dot
    val eyeBase = if (template == Template.Twin) minOf(bh - 6, 2 * maxOf(5, half * 70 / 100)) * 35 / 100
        else if (template == Template.Serpent) maxOf(0, serpentHead - 3)
        else bh * EYE_PCT.getValue(template) / 100
    val (fitY, fitInner) = fitEyes(snap2, eyeStyle, y0 + eyeBase, 2 + eyeInnerRoll + (if (half >= 11) 2 else 0))
    val anchors = Anchors(fitY, fitInner, minOf(fitY + 8, y0 + bh - 4))

    // Face marks sit relative to the eyes, so they are drawn once the eyes are placed. Only body pixels change.
    fun paint(x: Int, y: Int) {
        val v = at(g, x, y)
        if (v == Cell.BODY || v == Cell.SHADE || v == Cell.LIGHT) put(g, x, y, Cell.ACCENT)
    }
    if (mark == Mark.Cheeks) {
        val lx = AXIS - fitInner - 5
        for (dy in 0 until 2) {
            for (dx in 0 until 3) {
                paint(lx + dx, fitY + 7 + dy)
                paint(SIZE - 1 - (lx + dx), fitY + 7 + dy)
            }
        }
    } else if (mark == Mark.Gem) {
        for (dy in 0 until 2) for (x in AXIS - 1..AXIS + 2) paint(x, fitY - 4 + dy)
    }

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

    val sprite = Sprite(version, seed, norm, traits, template, mark, eyeStyle, anchors, g, colors, colorName)
    sprite.grid = compose(sprite, Pose())
    return sprite
}
