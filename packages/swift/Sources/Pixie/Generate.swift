import Foundation

// Spec: spec/sprite.md. Text -> Sprite. Pure function of (text, version, palette preset).
// The order of rng draws is part of the algorithm: it must match the TypeScript core exactly.
//
// Geometry (32x32 grid): the left half is columns 0...15 and is mirrored onto 16...31. The body sits on the
// ground (its last row is 25), feet use rows 26...29, row 30 is outline. Rows 0...3 are kept free for parts
// that stick up, the outline above them, and lifting. A tail is drawn after mirroring, on the right only.

private struct PartRolls {
    var present: Int
    var tone: Int
    var part: UInt32
    var dx: UInt32
    var row: UInt32
}

private let partValue: [Character: UInt8] = ["#": Cell.body, "a": Cell.accent, "d": Cell.shade, "l": Cell.light]

/// Body shapes. Round-sounding text picks from the soft list, sharp-sounding text from the sharp list, and text
/// full of hissing, slithering letters (s z x h w y l) often picks from the sinuous list: snakes and worms.
private let softShapes: [Template] = [.blob, .egg, .pear, .capsule, .dome, .cloud, .twin, .box, .mushroom, .bell, .drop, .jelly]
private let sharpShapes: [Template] = [.star, .gem, .wedge, .hex, .kite, .shield, .hourglass]
private let sinuousShapes: [Template] = [.serpent, .cobra, .caterpillar]
/// Where the eyes start, as a percent of the body height.
private let eyePercent: [Template: Int] = [
    .blob: 30, .egg: 30, .pear: 25, .capsule: 25, .dome: 35, .cloud: 35, .twin: 0, .box: 30, .mushroom: 25, .bell: 45,
    .drop: 50, .jelly: 25, .star: 40, .gem: 40, .wedge: 45, .hex: 30, .kite: 40, .shield: 25, .hourglass: 15,
    .serpent: 0, .cobra: 10, .caterpillar: 8,
]

private func topOf(_ g: [UInt8], _ x: Int) -> Int {
    for y in 0..<pixieSize where at(g, x, y) != 0 { return y }
    return -1
}

private func bottomOf(_ g: [UInt8], _ x: Int) -> Int {
    for y in stride(from: pixieSize - 1, through: 0, by: -1) where at(g, x, y) != 0 { return y }
    return -1
}

private func leftOf(_ g: [UInt8], _ y: Int) -> Int {
    for x in 0..<pixieSize where at(g, x, y) != 0 { return x }
    return -1
}

private func rightOf(_ g: [UInt8], _ y: Int) -> Int {
    for x in stride(from: pixieSize - 1, through: 0, by: -1) where at(g, x, y) != 0 { return x }
    return -1
}

private func putIfEmpty(_ g: inout [UInt8], _ x: Int, _ y: Int, _ v: UInt8) {
    if at(g, x, y) == 0 { put(&g, x, y, v) }
}

/// Integer square root, floor. Exact for the small numbers used here.
private func isqrt(_ n: Int) -> Int {
    if n <= 0 { return 0 }
    var r = Int(Double(n).squareRoot())
    while r * r > n { r -= 1 }
    while (r + 1) * (r + 1) <= n { r += 1 }
    return r
}

/// Half width, in cells, of row r of an ellipse that is `hw` cells wide on each side and `h` rows tall.
private func ellipseHw(_ r: Int, _ hw: Int, _ h: Int) -> Int {
    let t = 2 * r + 1 - h
    return (hw * isqrt(h * h - t * t) * 2 + h) / (2 * h)
}

/// Half width of row i (from the end) of a round cap of radius ra.
private func capHw(_ i: Int, _ ra: Int) -> Int {
    (isqrt((2 * i + 1) * (4 * ra - 2 * i - 1)) + 1) / 2
}

/// Widest of several ellipses stacked down the body. Each is (first row, height, half width).
private func stackHw(_ r: Int, _ segs: [(Int, Int, Int)]) -> Int {
    var v = 0
    for (start, h, w) in segs where r >= start && r < start + h { v = max(v, ellipseHw(r - start, w, h)) }
    return v
}

/// Half width in cells for every body row. Each shape is a different silhouette; widths are clamped to 1...half.
private func rowWidths(_ t: Template, _ half: Int, _ bh: Int, _ k: Int, _ halfTop: Int) -> [Int] {
    var w: [Int] = []
    func mid(_ r: Int) -> Int { abs(2 * r + 1 - bh) * half / bh } // distance from the middle row, in cells
    let sq = half * 55 / 100
    for r in 0..<bh {
        var v: Int
        switch t {
        case .blob:
            v = ellipseHw(r, half, bh)
        case .egg:
            v = ellipseHw(r, half, bh) * (65 + 35 * r / (bh - 1)) / 100
        case .pear:
            v = ellipseHw(r, half, bh) * (30 + 70 * r / (bh - 1)) / 100
        case .capsule:
            let ra = min(half, bh / 2)
            v = r < ra ? half - ra + capHw(r, ra) : r >= bh - ra ? half - ra + capHw(bh - 1 - r, ra) : half
        case .dome:
            let tt = max(4, bh * 60 / 100)
            v = r < tt ? (half * isqrt((2 * r + 1) * (4 * tt - 2 * r - 1)) + tt) / (2 * tt) : half
        case .cloud:
            let tt = max(4, bh * 70 / 100)
            v = r < tt ? (half * isqrt((2 * r + 1) * (4 * tt - 2 * r - 1)) + tt) / (2 * tt) : half
        case .twin:
            let rh = max(5, half * 70 / 100)
            let hh = min(bh - 6, 2 * rh)
            let s = hh - 2
            let head = r < hh ? ellipseHw(r, rh, hh) : 0
            let body = r >= s ? ellipseHw(r - s, half, bh - s) : 0
            v = max(head, body)
        case .box:
            v = half - max(0, k - min(r, bh - 1 - r))
        case .star:
            let d = mid(r)
            v = max(d <= sq ? sq : 0, half - d)
        case .gem:
            v = half - mid(r)
        case .wedge:
            v = halfTop + (half - halfTop) * r / (bh - 1)
        case .hex:
            let q = max(2, bh / 3)
            v = r < q ? half * (r + 1) / q : r >= bh - q ? half * (bh - r) / q : half
        case .kite:
            let s = max(3, bh * 35 / 100)
            v = r < s ? half * (r + 1) / s : half * (bh - r) / (bh - s)
        case .mushroom:
            let tt = max(4, bh * 55 / 100)
            v = r < tt ? (half * isqrt((2 * r + 1) * (4 * tt - 2 * r - 1)) + tt) / (2 * tt) : max(3, half * 40 / 100)
        case .jelly:
            let tt = max(4, bh * 55 / 100)
            v = r < tt ? (half * isqrt((2 * r + 1) * (4 * tt - 2 * r - 1)) + tt) / (2 * tt) : half * 85 / 100
        case .bell:
            let q = 100 * r / (bh - 1)
            v = half * (30 + 70 * q * q / 10000) / 100
        case .drop:
            let s = max(3, bh * 45 / 100)
            v = r < s ? half * (r + 1) * (r + 1) / ((s + 1) * (s + 1)) : ellipseHw(bh - s + (r - s), half, 2 * (bh - s))
        case .shield:
            let s = bh * 55 / 100
            v = r < s ? half - max(0, 2 - r) : half * (bh - r) / (bh - s)
        case .hourglass:
            v = half * (35 + 65 * abs(2 * r + 1 - bh) / bh) / 100
        case .cobra:
            let b0 = bh * 42 / 100, b1 = bh * 66 / 100
            v = stackHw(r, [
                (0, max(5, bh * 40 / 100), half), // hood
                (bh * 30 / 100, max(3, bh * 20 / 100 + 1), max(3, half * 30 / 100)), // neck
                (b0, max(4, bh * 30 / 100), half * 80 / 100), // first coil
                (b1, bh - b1, half * 95 / 100), // second coil
            ])
        case .caterpillar:
            let h = bh * 34 / 100 + 1
            v = stackHw(r, [
                (0, h, max(6, half * 70 / 100)), // head
                (bh * 22 / 100, h, half * 85 / 100),
                (bh * 44 / 100, h, half),
                (bh * 66 / 100, h, half * 75 / 100),
            ])
        case .serpent:
            v = 1 // drawn from circles instead, see serpentCells
        }
        w.append(clamp(v, 1, half))
    }
    return w
}

/// One period of a sine wave in sixteenths, 32 steps. Used for the coils of a snake.
private let sin32 = [0, 3, 6, 9, 11, 13, 15, 16, 16, 16, 15, 13, 11, 9, 6, 3, 0, -3, -6, -9, -11, -13, -15, -16, -16, -16, -15, -13, -11, -9, -6, -3]

/// Fill a circle of radius r (in cells) centered on cell row cy, at doubled column c2x.
private func stamp(_ g: inout [UInt8], _ c2x: Int, _ cy: Int, _ r: Int) {
    let c2y = 2 * cy + 1
    for y in (cy - r - 1)...(cy + r + 1) {
        for x in 0..<pixieSize {
            let dx = 2 * x + 1 - c2x
            let dy = 2 * y + 1 - c2y
            if dx * dx + dy * dy <= 4 * r * r { put(&g, x, y, Cell.body) }
        }
    }
}

/// A coiled snake: a round head on a short neck, resting on two stacked ring-shaped coils with holes you can see
/// through. Built from a chain of circles along two ellipses. Not mirrored from a half. Returns the head radius.
private func serpentCells(_ g: inout [UInt8], _ y0: Int) -> Int {
    let r0 = 5 // head radius
    stamp(&g, pixieSize, y0 + r0, r0)
    stamp(&g, pixieSize, y0 + r0 + 1, r0 - 1)
    for cy in (y0 + r0 + 3)...(y0 + r0 + 5) { stamp(&g, pixieSize, cy, 2) } // neck
    func coil(_ cy: Int, _ rx: Int, _ ry: Int) {
        for j in 0..<32 {
            stamp(&g, pixieSize + 2 * (rx * sin32[(j + 8) & 31] / 16), cy + ry * sin32[j] / 16, 2)
        }
    }
    coil(pixieGround - 10, 8, 3) // upper coil
    coil(pixieGround - 4, 12, 4) // lower, wider coil
    return r0
}

private func placePart(_ g: inout [UInt8], _ part: PartDef, _ rolls: PartRolls, _ y0: Int, _ bh: Int, _ half: Int) {
    let rows = part.rows.map { Array($0) }
    let h = rows.count
    let w = rows[0].count
    func cell(_ i: Int, _ j: Int) -> UInt8 {
        guard i < rows.count, j < rows[i].count else { return 0 }
        return partValue[rows[i][j]] ?? 0
    }
    let xl = pixieAxis + 1 - half

    if part.slot == "top" {
        // Slide inward until body lies under every column of the part (narrow tops, stars, snakes...), else skip it.
        var ax = max(xl, pixieAxis - part.dx[Int(rolls.dx) % part.dx.count])
        while ax < pixieAxis && (topOf(g, ax) < 0 || topOf(g, ax - (w - 1)) < 0) { ax += 1 }
        if topOf(g, ax) < 0 || topOf(g, ax - (w - 1)) < 0 { return }
        let yb = topOf(g, ax) - 1
        for i in 0..<h {
            let y = yb - (h - 1) + i
            if y < pixieTop { continue }
            for j in 0..<w {
                let x = ax - (w - 1) + j
                let v = cell(i, j)
                if v != 0 && x >= 1 { putIfEmpty(&g, x, y, v) }
            }
        }
        // Roots: stretch each column down to the body so nothing floats.
        for j in 0..<w {
            let x = ax - (w - 1) + j
            var lowest = -1
            for i in 0..<h where cell(i, j) != 0 && yb - (h - 1) + i >= pixieTop { lowest = yb - (h - 1) + i }
            if lowest < 0 || x < 1 { continue }
            var y = lowest + 1, n = 0
            while y < pixieSize && n < 8 && at(g, x, y) == 0 {
                put(&g, x, y, Cell.body)
                y += 1; n += 1
            }
        }
    } else if part.slot == "side" {
        let ys = y0 + 4 + Int(rolls.row) % max(1, bh - 8)
        let lx = leftOf(g, ys)
        if lx < 0 { return }
        let xr = lx - 1
        if xr - (w - 1) < 1 { return }
        for i in 0..<h {
            for j in 0..<w {
                let v = cell(i, j)
                if v != 0 { putIfEmpty(&g, xr - (w - 1) + j, ys + i, v) }
            }
            // Reach back to the body on this row.
            var rightmost = -1
            for j in 0..<w where cell(i, j) != 0 { rightmost = xr - (w - 1) + j }
            var x = rightmost + 1, n = 0
            while rightmost >= 0 && x <= pixieAxis && n < 6 && at(g, x, ys + i) == 0 {
                put(&g, x, ys + i, Cell.body)
                x += 1; n += 1
            }
        }
    } else if part.slot == "bottom" {
        var ax = max(xl, pixieAxis - part.dx[Int(rolls.dx) % part.dx.count])
        while ax < pixieAxis && (bottomOf(g, ax) < 0 || bottomOf(g, ax - (w - 1)) < 0) { ax += 1 }
        let yb = bottomOf(g, ax)
        if yb < 0 || bottomOf(g, ax - (w - 1)) < 0 { return }
        for i in 0..<h {
            let y = yb + 1 + i
            if y > pixieGround + 4 { continue }
            for j in 0..<w {
                let x = ax - (w - 1) + j
                let v = cell(i, j)
                if v != 0 && x >= 1 { putIfEmpty(&g, x, y, v) }
            }
        }
        // Stretch each column up to the body.
        for j in 0..<w {
            let x = ax - (w - 1) + j
            var top = -1
            for i in stride(from: h - 1, through: 0, by: -1) where cell(i, j) != 0 && yb + 1 + i <= pixieGround + 4 { top = yb + 1 + i }
            if top < 0 || x < 1 { continue }
            var y = top - 1, n = 0
            while y >= 0 && n < 6 && at(g, x, y) == 0 {
                put(&g, x, y, Cell.body)
                y -= 1; n += 1
            }
        }
    } else {
        // Tail: right side only. The bottom row sits on a body row in the lower half; the first column touches the body.
        let ys = y0 + bh * 55 / 100 + Int(rolls.row) % max(1, bh * 30 / 100)
        let rx = rightOf(g, ys)
        if rx < 0 { return }
        let x0 = rx + 1
        for i in 0..<h {
            let y = ys - (h - 1) + i
            if y < pixieTop { continue }
            for j in 0..<w {
                let v = cell(i, j)
                if v != 0 && x0 + j < pixieSize - 1 { putIfEmpty(&g, x0 + j, y, v) }
            }
            // Reach back to the body on this row.
            var leftmost = -1
            for j in stride(from: w - 1, through: 0, by: -1) where cell(i, j) != 0 { leftmost = x0 + j }
            var x = leftmost - 1, n = 0
            while leftmost >= 0 && x >= pixieAxis + 1 && n < 6 && at(g, x, y) == 0 {
                put(&g, x, y, Cell.body)
                x -= 1; n += 1
            }
        }
    }
}

/// Snakes are plain coils with at most a tail, cobras are plain, caterpillars get feelers and feet; everything else can have every part.
private func allows(_ t: Template, _ slot: String) -> Bool {
    if t == .serpent { return slot == "tail" }
    if t == .cobra { return false }
    if t == .caterpillar { return slot == "top" || slot == "bottom" }
    return true
}

private func pickPart(_ slot: String, _ wantSoft: Bool, _ rolls: PartRolls, _ chaos: Int) -> PartDef? {
    let flip = rolls.tone < 20 + chaos / 5
    let soft = flip ? !wantSoft : wantSoft
    let pool = SpecData.parts.filter { $0.slot == slot && $0.tone == (soft ? "soft" : "sharp") }
    if pool.isEmpty { return nil }
    return pool[Int(rolls.part) % pool.count]
}

/// Widest eye spacing (at most `pref`, at least 1) whose left eye sits fully on the body, moving the eyes
/// down up to four rows when the body is too narrow. The eye box is 6x6; a "dot" eye needs its lower-right 4x4.
private func fitEyes(_ fill: [UInt8], _ style: EyeStyle, _ eyeY0: Int, _ pref: Int) -> (eyeY: Int, eyeInner: Int) {
    let offsets = style == .big ? [0, 1, 2, 3, 4, 5] : [2, 3, 4, 5]
    for margin in [1, 0] {
        for dy in 0...4 {
            for ei in stride(from: pref, through: 1, by: -1) {
                let lx = pixieAxis - ei - 5
                var ok = true
                for r in offsets {
                    for c in offsets where at(fill, lx + c, eyeY0 + dy + r) == 0 { ok = false }
                    if margin == 1 && at(fill, lx + offsets[0] - 1, eyeY0 + dy + r) == 0 { ok = false }
                }
                if ok { return (eyeY0 + dy, ei) }
            }
        }
    }
    return (eyeY0, 1)
}

public struct GenerateError: Error { public let message: String }

/// Text -> mascot. Same normalized text, version and palette always give the same sprite.
public func generate(_ text: String, version: Int = pixieVersion, palette: PresetName? = nil) throws -> Sprite {
    if version != pixieVersion { throw GenerateError(message: "Unsupported Pixie algorithm version: \(version)") }

    let norm = normalize(text)
    let seed = hashText(norm)
    let rng = Rng(seed: seed)

    let traits = computeTraits(norm, rng)
    let roundness = traits.roundness, heft = traits.heft, energy = traits.energy, chaos = traits.chaos

    // Body shape and proportions.
    let eff = clamp(roundness + (rng.int(15) - 7))
    let familyRoll = rng.int(100)
    let shapeRoll = rng.int(1000)
    let heightRoll = rng.int(3)
    let stretchRoll = rng.int(5)
    let widthRoll = rng.int(3)
    let leanRoll = rng.int(61) - 30
    let chamferRoll = rng.int(3)
    let wedgeRoll = rng.int(3)
    // Hissing, slithering letters often make a snake or worm; a few other texts get one by chance.
    let sinuous = (traits.slink >= 30 && familyRoll < 70) || familyRoll < 4
    let list = sinuous ? sinuousShapes : eff >= 50 ? softShapes : sharpShapes
    let template = list[shapeRoll % list.count]
    // Heft says wide or tall, but a roll of its own keeps heavy-sounding words from all being flat blobs.
    // Pointy shapes cover less area, so they are drawn a little bigger.
    let lean = clamp(heft + leanRoll)
    let grow = (template == .star || template == .gem || template == .kite || template == .hex) ? 2 : template == .wedge ? 1 : 0
    let half = clamp(7 + lean * 6 / 100 + widthRoll - 1 + grow, 7, 13) // 7...13 columns on the left side
    // A snake fills the whole height; everything else is 10...18 rows tall.
    let bh = template == .serpent ? pixieGround - pixieTop + 1 : clamp(18 - lean * 7 / 100 - heightRoll + stretchRoll - 2, 10, 18)
    let y0 = pixieGround - bh + 1
    let xl = pixieAxis + 1 - half
    let k = 2 + chamferRoll // chamfer size of the box
    let halfTop = min(half, 3 + wedgeRoll) // half width at the top of the wedge

    var g = [UInt8](repeating: 0, count: pixieSize * pixieSize)
    // The head of a serpent is a circle, so its eyes have less room than a body of the same width.
    var eyeRoom = half
    var serpentHead = 0
    if template == .serpent {
        serpentHead = serpentCells(&g, y0)
        eyeRoom = serpentHead
    } else {
        let widths = rowWidths(template, half, bh, k, halfTop)
        let jellyTop = max(4, bh * 55 / 100)
        for r in 0..<bh {
            for c in 0..<half {
                // The cloud's lower edge is scalloped: every other group of three columns is three rows shorter.
                if template == .cloud && r >= bh - (c % 6 < 3 ? 0 : 3) { continue }
                // A jellyfish keeps only thin strands of different lengths under its dome.
                if template == .jelly && r >= jellyTop && !(c % 4 == 1 && r < bh - ((c * 5) % 4)) { continue }
                if half - c <= widths[r] {
                    put(&g, xl + c, y0 + r, Cell.body)
                    put(&g, pixieSize - 1 - (xl + c), y0 + r, Cell.body)
                }
            }
        }
    }
    let bodyOnly = g

    // Parts. Every slot always draws the same five numbers.
    func draw() -> PartRolls {
        PartRolls(present: rng.int(100), tone: rng.int(100), part: rng.next(), dx: rng.next(), row: rng.next())
    }
    let rTop = draw(), rSide = draw(), rBottom = draw(), rTop2 = draw(), rTail = draw()
    let wantSoft = eff >= 50
    let plan: [(String, PartRolls, Int)] = [
        ("top", rTop, 70),
        ("side", rSide, 30 + energy / 3),
        ("bottom", rBottom, 80),
        ("top", rTop2, energy >= 60 ? 60 : 0),
    ]
    for (slot, rolls, chance) in plan {
        if rolls.present >= chance || !allows(template, slot) { continue }
        if let part = pickPart(slot, wantSoft, rolls, chaos) { placePart(&g, part, rolls, y0, bh, half) }
    }

    // Mirror the parts (placed on the left half) onto the right half. The body already has both sides.
    for y in 0..<pixieSize {
        for x in 0...pixieAxis where g[y * pixieSize + x] != bodyOnly[y * pixieSize + x] {
            put(&g, pixieSize - 1 - x, y, UInt8(at(g, x, y)))
        }
    }

    // Marks. One decoration per mascot; always draw the same seven numbers. They only ever paint body pixels.
    let markRoll = rng.int(100)
    let mr = [rng.next(), rng.next(), rng.next(), rng.next(), rng.next(), rng.next()].map { Int($0) }
    let mark: Mark = markRoll < 25 ? .none : markRoll < 45 ? .belly : markRoll < 60 ? .spots : markRoll < 72 ? .stripes : markRoll < 88 ? .cheeks : .gem
    let body = Int(Cell.body)
    if mark == .belly {
        let rc = y0 + bh * 68 / 100
        let hh = max(2, bh * 22 / 100)
        let hwb = max(3, half * 55 / 100)
        for y in (rc - hh)...(rc + hh) {
            for x in 0..<pixieSize {
                let dxc = x <= pixieAxis ? pixieAxis + 1 - x : x - pixieAxis
                let dyy = y - rc
                if dxc * dxc * hh * hh + dyy * dyy * hwb * hwb <= hwb * hwb * hh * hh && at(g, x, y) == body { put(&g, x, y, Cell.light) }
            }
        }
    } else if mark == .spots {
        for i in 0..<3 {
            let x = xl + 2 + (mr[2 * i] % max(1, half - 5))
            let y = y0 + 3 + (mr[2 * i + 1] % max(1, bh - 8))
            for sx in [x, pixieSize - 2 - x] {
                if at(g, sx, y) == body && at(g, sx + 1, y) == body && at(g, sx, y + 1) == body && at(g, sx + 1, y + 1) == body {
                    put(&g, sx, y, Cell.shade)
                    put(&g, sx + 1, y, Cell.shade)
                    put(&g, sx, y + 1, Cell.shade)
                    put(&g, sx + 1, y + 1, Cell.shade)
                }
            }
        }
    } else if mark == .stripes {
        let bands = 2 + (mr[0] % 2)
        let gap = 2 + (mr[1] % 2)
        for b in 0..<bands {
            let yy = y0 + 3 + b * (2 + gap)
            for dy in 0..<2 {
                for x in 0..<pixieSize where at(g, x, yy + dy) == body { put(&g, x, yy + dy, Cell.shade) }
            }
        }
    }

    // A tail grows on the right side only, so it is the one thing that is not mirrored.
    if rTail.present < 25 + chaos / 4 + energy / 5 && allows(template, "tail") {
        if let part = pickPart("tail", wantSoft, rTail, chaos) { placePart(&g, part, rTail, y0, bh, half) }
    }

    // Chaos breaks symmetry.
    let mutations = chaos / 25
    for _ in 0..<mutations {
        let typeRoll = Int(rng.next())
        let pickRoll = Int(rng.next())
        var cands: [Int] = []
        let chip = typeRoll % 2 == 0
        for y in pixieTop..<(pixieGround + 5) {
            for x in (pixieAxis + 1)..<pixieSize {
                let v = at(g, x, y)
                if chip {
                    let edge = at(g, x - 1, y) == 0 || at(g, x + 1, y) == 0 || at(g, x, y - 1) == 0 || at(g, x, y + 1) == 0
                    if v == body && edge && at(g, x, y - 1) == 0 { cands.append(y * pixieSize + x) }
                } else if v == 0 && at(g, x, y + 1) == body && at(g, x, y - 1) == 0 {
                    cands.append(y * pixieSize + x)
                }
            }
        }
        if !cands.isEmpty {
            let idx = cands[pickRoll % cands.count]
            g[idx] = chip ? Cell.clear : Cell.body
        }
    }

    // Shade the bottom two rows of every downward-facing edge, add a three-pixel shine, then outline.
    // Each pass reads a snapshot.
    let snap1 = g
    for y in 0..<pixieSize {
        for x in 0..<pixieSize where at(snap1, x, y) == body && (at(snap1, x, y + 1) == 0 || at(snap1, x, y + 2) == 0) {
            put(&g, x, y, Cell.shade)
        }
    }
    scan: for y in 0..<pixieSize {
        for x in 0..<pixieSize {
            if at(g, x, y) == body && at(g, x + 1, y) == body && at(g, x + 2, y) == body
                && at(g, x, y + 1) == body && at(g, x + 1, y + 1) == body && at(g, x, y + 2) == body
                && at(g, x - 1, y) != 0 {
                put(&g, x, y, Cell.light)
                put(&g, x + 1, y, Cell.light)
                put(&g, x, y + 1, Cell.light)
                break scan
            }
        }
    }
    let snap2 = g
    for y in 0..<pixieSize {
        for x in 0..<pixieSize {
            if at(snap2, x, y) != 0 { continue }
            if at(snap2, x - 1, y) != 0 || at(snap2, x + 1, y) != 0 || at(snap2, x, y - 1) != 0 || at(snap2, x, y + 1) != 0 {
                put(&g, x, y, Cell.outline)
            }
        }
    }

    // Face anchors. Narrow bodies cannot hold the big 6x6 eyes, so they get the small ones.
    let eyeInnerRoll = rng.int(3)
    let eyeStyleRoll = rng.int(40)
    let eyeStyle: EyeStyle = clamp(roundness + eyeStyleRoll - 20) >= 50 && eyeRoom >= 9 ? .big : .dot
    let eyeBase: Int
    if template == .twin {
        eyeBase = min(bh - 6, 2 * max(5, half * 70 / 100)) * 35 / 100
    } else if template == .serpent {
        eyeBase = max(0, serpentHead - 3)
    } else {
        eyeBase = bh * eyePercent[template]! / 100
    }
    let fit = fitEyes(snap2, eyeStyle, y0 + eyeBase, 2 + eyeInnerRoll + (half >= 11 ? 2 : 0))
    let anchors = Anchors(eyeY: fit.eyeY, eyeInner: fit.eyeInner, mouthY: min(fit.eyeY + 8, y0 + bh - 4))

    // Face marks sit relative to the eyes, so they are drawn once the eyes are placed. Only body pixels change.
    func paint(_ x: Int, _ y: Int) {
        let v = at(g, x, y)
        if v == body || v == Int(Cell.shade) || v == Int(Cell.light) { put(&g, x, y, Cell.accent) }
    }
    if mark == .cheeks {
        let lx = pixieAxis - fit.eyeInner - 5
        for dy in 0..<2 {
            for dx in 0..<3 {
                paint(lx + dx, fit.eyeY + 7 + dy)
                paint(pixieSize - 1 - (lx + dx), fit.eyeY + 7 + dy)
            }
        }
    } else if mark == .gem {
        for dy in 0..<2 {
            for x in (pixieAxis - 1)...(pixieAxis + 2) { paint(x, fit.eyeY - 4 + dy) }
        }
    }

    // Colors.
    let entryRoll = Int(rng.next())
    let pool = energy >= 60 ? SpecData.vivid : roundness >= 50 ? SpecData.pastel : SpecData.deep
    let entry = pool[entryRoll % pool.count]
    var colors = ["", entry.body, entry.outline, entry.shade, entry.light, entry.accent, entry.outline, SpecData.white]
    var colorName = entry.name
    if let palette, let p = SpecData.presets[palette.rawValue] {
        colors = ["", p[2], p[0], p[1], p[3], p[2], p[0], p[3]]
        colorName = palette.rawValue
    }

    var sprite = Sprite(
        version: version, seed: seed, text: norm, traits: traits, template: template, mark: mark, eyeStyle: eyeStyle,
        anchors: anchors, body: g, grid: g, colors: colors, colorName: colorName
    )
    sprite.grid = compose(sprite, Pose())
    return sprite
}
