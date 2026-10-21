package dev.pixie

// Spec: spec/sprite.md. Text -> Sprite. Pure function of (text, version, palette preset).
// The order of rng draws is part of the algorithm: it must match the TypeScript core exactly.
//
// Geometry (32x32 grid): the left half is columns 0..15 and is mirrored onto 16..31. The body sits on the
// ground (its last row is 25), feet use rows 26..29, row 30 is outline. Rows 0..3 are kept free for parts
// that stick up, the outline above them, and the idle bob. A tail is drawn after mirroring, on the right only.

private class PartRolls(val present: Int, val tone: Int, val part: Long, val dx: Long, val row: Long)

private val PART_VALUE = mapOf('#' to Cell.BODY, 'a' to Cell.ACCENT, 'd' to Cell.SHADE, 'l' to Cell.LIGHT)

/** Body shapes. Round-sounding text picks from the soft list, sharp-sounding text from the sharp list. */
private val SOFT = listOf(Template.Blob, Template.Egg, Template.Pear, Template.Capsule, Template.Dome, Template.Cloud, Template.Twin, Template.Box)
private val SHARP = listOf(Template.Star, Template.Gem, Template.Wedge, Template.Hex, Template.Kite)

/** Where the eyes start, as a percent of the body height. */
private val EYE_PCT = mapOf(
    Template.Blob to 30, Template.Egg to 30, Template.Pear to 25, Template.Capsule to 25, Template.Dome to 35,
    Template.Cloud to 35, Template.Twin to 0, Template.Box to 30, Template.Star to 40, Template.Gem to 40,
    Template.Wedge to 45, Template.Hex to 30, Template.Kite to 40,
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
        }
        w[r] = clamp(v, 1, half)
    }
    return w
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
            // Move inward until there is body under the anchor column (narrow tops, stars, kites...).
            var ax = maxOf(xl, AXIS - part.dx[(rolls.dx % part.dx.size).toInt()])
            while (ax < AXIS && topOf(g, ax) < 0) ax++
            if (topOf(g, ax) < 0) return
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
            while (ax < AXIS && bottomOf(g, ax) < 0) ax++
            val yb = bottomOf(g, ax)
            if (yb < 0) return
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
    val shapeRoll = rng.int(1000)
    val heightRoll = rng.int(3)
    val stretchRoll = rng.int(5)
    val widthRoll = rng.int(3)
    val leanRoll = rng.int(61) - 30
    val chamferRoll = rng.int(3)
    val wedgeRoll = rng.int(3)
    val list = if (eff >= 50) SOFT else SHARP
    val template = list[shapeRoll % list.size]
    // Heft says wide or tall, but a roll of its own keeps heavy-sounding words from all being flat blobs.
    // Pointy shapes cover less area, so they are drawn a little bigger.
    val lean = clamp(heft + leanRoll)
    val grow = if (template == Template.Star || template == Template.Gem || template == Template.Kite || template == Template.Hex) 2 else if (template == Template.Wedge) 1 else 0
    val half = clamp(7 + lean * 6 / 100 + widthRoll - 1 + grow, 7, 13) // 7..13 columns on the left side
    val bh = clamp(18 - lean * 7 / 100 - heightRoll + stretchRoll - 2, 10, 18) // 10..18 rows tall
    val y0 = GROUND - bh + 1
    val xl = AXIS + 1 - half
    val k = 2 + chamferRoll // chamfer size of the box
    val halfTop = minOf(half, 3 + wedgeRoll) // half width at the top of the wedge

    val g = IntArray(SIZE * SIZE)
    val widths = rowWidths(template, half, bh, k, halfTop)
    for (r in 0 until bh) {
        for (c in 0 until half) {
            // The cloud's lower edge is scalloped: every other group of three columns is three rows shorter.
            if (template == Template.Cloud && r >= bh - (if (c % 6 < 3) 0 else 3)) continue
            if (half - c <= widths[r]) put(g, xl + c, y0 + r, Cell.BODY)
        }
    }

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
        if (rolls.present >= chance) continue
        pickPart(slot, wantSoft, rolls, chaos)?.let { placePart(g, it, rolls, y0, bh, half) }
    }

    // Marks. One decoration per mascot; always draw the same seven numbers.
    val markRoll = rng.int(100)
    val mr = LongArray(6) { rng.next().toLong() }
    val mark = if (markRoll < 25) Mark.None else if (markRoll < 45) Mark.Belly else if (markRoll < 60) Mark.Spots else if (markRoll < 72) Mark.Stripes else if (markRoll < 88) Mark.Cheeks else Mark.Gem
    if (mark == Mark.Belly) {
        val rc = y0 + bh * 68 / 100
        val hh = maxOf(2, bh * 22 / 100)
        val hwb = maxOf(3, half * 55 / 100)
        for (y in rc - hh..rc + hh) {
            for (x in xl..AXIS) {
                val dxc = AXIS + 1 - x
                val dyy = y - rc
                if (dxc * dxc * hh * hh + dyy * dyy * hwb * hwb <= hwb * hwb * hh * hh && at(g, x, y) == Cell.BODY) put(g, x, y, Cell.LIGHT)
            }
        }
    } else if (mark == Mark.Spots) {
        for (i in 0 until 3) {
            val x = xl + 2 + (mr[2 * i] % maxOf(1, half - 5)).toInt()
            val y = y0 + 3 + (mr[2 * i + 1] % maxOf(1, bh - 8)).toInt()
            if (at(g, x, y) == Cell.BODY && at(g, x + 1, y) == Cell.BODY && at(g, x, y + 1) == Cell.BODY && at(g, x + 1, y + 1) == Cell.BODY) {
                put(g, x, y, Cell.SHADE)
                put(g, x + 1, y, Cell.SHADE)
                put(g, x, y + 1, Cell.SHADE)
                put(g, x + 1, y + 1, Cell.SHADE)
            }
        }
    } else if (mark == Mark.Stripes) {
        val bands = 2 + (mr[0] % 2).toInt()
        val gap = 2 + (mr[1] % 2).toInt()
        for (b in 0 until bands) {
            val yy = y0 + 3 + b * (2 + gap)
            for (dy in 0 until 2) {
                for (x in xl..AXIS) if (at(g, x, yy + dy) == Cell.BODY) put(g, x, yy + dy, Cell.SHADE)
            }
        }
    }

    // Mirror left half onto the right half.
    for (y in 0 until SIZE) for (x in 0..AXIS) put(g, SIZE - 1 - x, y, at(g, x, y))

    // A tail grows on the right side only, so it is the one thing that is not mirrored.
    if (rTail.present < 25 + chaos / 4 + energy / 5) {
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
    val eyeStyle = if (clamp(roundness + eyeStyleRoll - 20) >= 50 && half >= 9) EyeStyle.Big else EyeStyle.Dot
    val eyeBase = if (template == Template.Twin) minOf(bh - 6, 2 * maxOf(5, half * 70 / 100)) * 35 / 100 else bh * EYE_PCT.getValue(template) / 100
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
