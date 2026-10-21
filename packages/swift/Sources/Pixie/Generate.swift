import Foundation

// Spec: spec/sprite.md. Text -> Sprite. Pure function of (text, version, palette preset).
// The order of rng draws is part of the algorithm: it must match the TypeScript core exactly.

private struct PartRolls {
    var present: Int
    var tone: Int
    var part: UInt32
    var dx: UInt32
    var row: UInt32
}

private let partValue: [Character: UInt8] = ["#": Cell.body, "a": Cell.accent, "d": Cell.shade, "l": Cell.light]

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

private func putIfEmpty(_ g: inout [UInt8], _ x: Int, _ y: Int, _ v: UInt8) {
    if at(g, x, y) == 0 { put(&g, x, y, v) }
}

private func bodyCell(_ t: Template, _ c: Int, _ r: Int, _ half: Int, _ bh: Int, _ k: Int, _ halfTop: Int) -> Bool {
    let bw = half * 2
    let dx = (half - c) * 2 - 1
    let dy = 2 * r + 1 - bh
    switch t {
    case .blob: return dx * dx * bh * bh + dy * dy * bw * bw <= bw * bw * bh * bh
    case .gem: return dx * bh + abs(dy) * bw <= bw * bh
    case .box: return c + min(r, bh - 1 - r) >= k || c >= k || min(r, bh - 1 - r) >= k
    case .wedge: return half - c <= halfTop + (half - halfTop) * r / (bh - 1)
    }
}

private func placePart(_ g: inout [UInt8], _ part: PartDef, _ rolls: PartRolls, _ y0: Int, _ bh: Int, _ half: Int) {
    let rows = part.rows.map { Array($0) }
    let h = rows.count
    let w = rows[0].count
    func cell(_ i: Int, _ j: Int) -> UInt8 {
        guard i < rows.count, j < rows[i].count else { return 0 }
        return partValue[rows[i][j]] ?? 0
    }
    let xl = 8 - half

    if part.slot == "top" {
        let dx = part.dx[Int(rolls.dx) % part.dx.count]
        let ax = 7 - dx
        if ax < xl || topOf(g, ax) < 0 { return }
        let yb = topOf(g, ax) - 1
        for i in 0..<h {
            let y = yb - (h - 1) + i
            if y < 2 { continue }
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
            for i in 0..<h where cell(i, j) != 0 && yb - (h - 1) + i >= 2 { lowest = yb - (h - 1) + i }
            if lowest < 0 || x < 1 { continue }
            var y = lowest + 1, n = 0
            while y < pixieSize && n < 4 && at(g, x, y) == 0 {
                put(&g, x, y, Cell.body)
                y += 1; n += 1
            }
        }
    } else if part.slot == "side" {
        let ys = y0 + 2 + Int(rolls.row) % max(1, bh - 3)
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
            while rightmost >= 0 && x <= 7 && n < 3 && at(g, x, ys + i) == 0 {
                put(&g, x, ys + i, Cell.body)
                x += 1; n += 1
            }
        }
    } else {
        let dx = part.dx[Int(rolls.dx) % part.dx.count]
        let ax = 7 - dx
        if ax < xl { return }
        let yb = bottomOf(g, ax)
        if yb < 0 { return }
        for i in 0..<h {
            let y = yb + 1 + i
            if y > 14 { continue }
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
            for i in stride(from: h - 1, through: 0, by: -1) where cell(i, j) != 0 && yb + 1 + i <= 14 { top = yb + 1 + i }
            if top < 0 || x < 1 { continue }
            var y = top - 1, n = 0
            while y >= 0 && n < 3 && at(g, x, y) == 0 {
                put(&g, x, y, Cell.body)
                y -= 1; n += 1
            }
        }
    }
}

private func pickPart(_ slot: String, _ wantSoft: Bool, _ rolls: PartRolls, _ chaos: Int) -> PartDef? {
    let flip = rolls.tone < 20 + chaos / 5
    let soft = flip ? !wantSoft : wantSoft
    let pool = SpecData.parts.filter { $0.slot == slot && $0.tone == (soft ? "soft" : "sharp") }
    if pool.isEmpty { return nil }
    return pool[Int(rolls.part) % pool.count]
}

/// Widest eye spacing (at most `pref`, at least 1) whose left eye sits fully on the body.
private func fitEyes(_ fill: [UInt8], _ style: EyeStyle, _ eyeY0: Int, _ pref: Int) -> (eyeY: Int, eyeInner: Int) {
    let offsets = style == .big ? [0, 1, 2] : [1, 2]
    for margin in [1, 0] {
        for dy in 0...2 {
            for ei in stride(from: pref, through: 1, by: -1) {
                let lx = 7 - ei - 2
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

    // Body shape.
    let eff = clamp(roundness + (rng.int(15) - 7))
    let heightRoll = rng.int(2)
    let chamferRoll = rng.int(2)
    let wedgeRoll = rng.int(2)
    let template: Template = eff >= 68 ? .blob : eff >= 45 ? .box : eff >= 25 ? .wedge : .gem
    let sizeIdx = heft < 34 ? 0 : heft < 67 ? 1 : 2
    let half = 4 + sizeIdx
    let bh = [9, 8, 7][sizeIdx] - heightRoll
    let y0 = 13 - bh
    let xl = 8 - half
    let k = 1 + chamferRoll
    let halfTop = min(half, 1 + wedgeRoll)

    var g = [UInt8](repeating: 0, count: pixieSize * pixieSize)
    for r in 0..<bh {
        for c in 0..<half where bodyCell(template, c, r, half, bh, k, halfTop) {
            put(&g, xl + c, y0 + r, Cell.body)
        }
    }

    // Parts. Every slot always draws the same five numbers.
    func draw() -> PartRolls {
        PartRolls(present: rng.int(100), tone: rng.int(100), part: rng.next(), dx: rng.next(), row: rng.next())
    }
    let rTop = draw(), rSide = draw(), rBottom = draw(), rTop2 = draw()
    let wantSoft = eff >= 50
    let plan: [(String, PartRolls, Int)] = [
        ("top", rTop, 70),
        ("side", rSide, 30 + energy / 3),
        ("bottom", rBottom, 80),
        ("top", rTop2, energy >= 60 ? 60 : 0),
    ]
    for (slot, rolls, chance) in plan {
        if rolls.present >= chance { continue }
        if let part = pickPart(slot, wantSoft, rolls, chaos) { placePart(&g, part, rolls, y0, bh, half) }
    }

    // Mirror left half onto the right half.
    for y in 0..<pixieSize {
        for x in 0..<8 { put(&g, 15 - x, y, UInt8(at(g, x, y))) }
    }

    // Chaos breaks symmetry.
    let mutations = chaos / 25
    for _ in 0..<mutations {
        let typeRoll = Int(rng.next())
        let pickRoll = Int(rng.next())
        var cands: [Int] = []
        let chip = typeRoll % 2 == 0
        for y in 2..<15 {
            for x in 8..<16 {
                let v = at(g, x, y)
                if chip {
                    let edge = at(g, x - 1, y) == 0 || at(g, x + 1, y) == 0 || at(g, x, y - 1) == 0 || at(g, x, y + 1) == 0
                    if v == Int(Cell.body) && edge && at(g, x, y - 1) == 0 { cands.append(y * pixieSize + x) }
                } else if v == 0 && at(g, x, y + 1) == Int(Cell.body) && at(g, x, y - 1) == 0 {
                    cands.append(y * pixieSize + x)
                }
            }
        }
        if !cands.isEmpty {
            let idx = cands[pickRoll % cands.count]
            g[idx] = chip ? Cell.clear : Cell.body
        }
    }

    // Shade bottoms, one highlight pixel, then outline. Each pass reads a snapshot.
    let snap1 = g
    for y in 0..<pixieSize {
        for x in 0..<pixieSize where at(snap1, x, y) == Int(Cell.body) && at(snap1, x, y + 1) == 0 {
            put(&g, x, y, Cell.shade)
        }
    }
    scan: for y in 0..<pixieSize {
        for x in 0..<pixieSize {
            if at(g, x, y) == Int(Cell.body) && at(g, x + 1, y) == Int(Cell.body)
                && at(g, x, y + 1) == Int(Cell.body) && at(g, x - 1, y) != 0 {
                put(&g, x, y, Cell.light)
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

    // Face anchors.
    let eyeInnerRoll = rng.int(2)
    let eyeStyleRoll = rng.int(40)
    let eyeStyle: EyeStyle = clamp(roundness + eyeStyleRoll - 20) >= 50 ? .big : .dot
    let fit = fitEyes(snap2, eyeStyle, y0 + bh * 30 / 100 + (template == .gem ? 1 : 0), 1 + eyeInnerRoll + (half == 6 ? 1 : 0))
    let anchors = Anchors(eyeY: fit.eyeY, eyeInner: fit.eyeInner, mouthY: min(fit.eyeY + 4, y0 + bh - 2))

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
        version: version, seed: seed, text: norm, traits: traits, template: template, eyeStyle: eyeStyle,
        anchors: anchors, body: g, grid: g, colors: colors, colorName: colorName
    )
    sprite.grid = compose(sprite, Pose())
    return sprite
}
