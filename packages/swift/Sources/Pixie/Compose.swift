import Foundation

// Spec: spec/sprite.md "Faces". Draws a mood onto the faceless body. Pure and integer-only.

private let colorOf: [Character: UInt8] = ["k": Cell.ink, "p": Cell.ink, "w": Cell.white, "a": Cell.accent]

/// Returns a new grid: the sprite's body with the pose's face drawn on it.
public func compose(_ sprite: Sprite, _ pose: Pose = Pose()) -> [UInt8] {
    let mood = pose.mood
    let gx = pose.gaze.x, gy = pose.gaze.y
    var g = sprite.body
    let eyeY = sprite.anchors.eyeY, eyeInner = sprite.anchors.eyeInner, mouthY = sprite.anchors.mouthY

    // Eyes: the right eye mirrors the left; gaze moves both the same way.
    let pattern = SpecData.eyes[sprite.eyeStyle.rawValue]?[pose.blink ? "blink" : mood.rawValue] ?? []
    let lx = pixieAxis - eyeInner - 5
    let rx = pixieAxis + 1 + eyeInner
    for pupilPass in [false, true] {
        for (i, rowString) in pattern.enumerated() {
            let row = Array(rowString)
            for (j, ch) in row.enumerated() {
                if ch == "." { continue }
                let isPupil = ch == "p"
                if pupilPass != isPupil { continue }
                let ox = isPupil ? gx * 2 : 0
                let oy = isPupil ? gy * 2 : 0
                let y = eyeY + i + oy
                for x in [lx + j + ox, rx + (row.count - 1 - j) + ox] {
                    if at(g, x, y) != 0 { put(&g, x, y, colorOf[ch] ?? Cell.ink) }
                }
            }
        }
    }

    // Mouth, centered.
    let mouth = SpecData.mouths[mood.rawValue] ?? []
    for (i, rowString) in mouth.enumerated() {
        let row = Array(rowString)
        let x0 = pixieAxis + 1 - row.count / 2
        for (j, ch) in row.enumerated() where ch != "." {
            if at(g, x0 + j, mouthY + i) != 0 { put(&g, x0 + j, mouthY + i, colorOf[ch] ?? Cell.ink) }
        }
    }

    // Motion: squash and stretch, lean, wave, shift and lift, applied to the whole mascot (face included).
    g = applyMotion(g, pose)

    // Props float in the top-right corner in the accent color.
    if let prop = SpecData.props[mood.rawValue] {
        for (i, rowString) in prop.rows.enumerated() {
            for (j, ch) in Array(rowString).enumerated() where ch != "." {
                put(&g, prop.x + j, prop.y + i, Cell.accent)
            }
        }
    }
    return g
}

/// A sideways ripple, in columns, for eight rows in a row. Rows are offset by the wave phase.
private let waveShift = [0, 1, 1, 0, 0, -1, -1, 0]

/// Moves the whole picture. Integer only, so every platform agrees.
/// 1. squash > 0 presses the body shorter, < 0 stretches it taller, keeping its feet on the same row;
/// 2. each row is shifted sideways by lean (more at the top), the wave, and dx;
/// 3. everything is lifted by `lift` rows. The top rows are always empty, so nothing is lost.
public func applyMotion(_ g: [UInt8], _ pose: Pose) -> [UInt8] {
    let squash = clamp(pose.squash, -3, 3)
    let lean = clamp(pose.lean, -3, 3)
    let dx = clamp(pose.dx, -3, 3)
    let lift = clamp(pose.lift, 0, pixieMaxLift)
    let amp = clamp(pose.amp, 0, 2)
    let wave = pose.wave & 7
    if squash == 0 && lean == 0 && dx == 0 && lift == 0 && amp == 0 { return g }

    var top = -1, bot = -1
    outer: for y in 0..<pixieSize {
        for x in 0..<pixieSize where g[y * pixieSize + x] != 0 { top = y; break outer }
    }
    outer: for y in stride(from: pixieSize - 1, through: 0, by: -1) {
        for x in 0..<pixieSize where g[y * pixieSize + x] != 0 { bot = y; break outer }
    }
    if top < 0 { return g }

    var cur = g
    if squash != 0 {
        let h = bot - top + 1
        let nh = clamp(h - squash, 4, bot + 1) // cannot grow above the top of the picture
        var out = [UInt8](repeating: 0, count: pixieSize * pixieSize)
        for i in 0..<nh {
            let src = top + i * h / nh
            let dst = bot - (nh - 1) + i
            for x in 0..<pixieSize { out[dst * pixieSize + x] = cur[src * pixieSize + x] }
        }
        cur = out
        top = bot - nh + 1
    }

    let span = max(1, bot - top)
    var out = [UInt8](repeating: 0, count: pixieSize * pixieSize)
    for y in top...bot {
        let shift = lean * (bot - y) / span + waveShift[(y + wave) & 7] * amp + dx
        let ny = y - lift
        if ny < 0 { continue }
        for x in 0..<pixieSize {
            let v = cur[y * pixieSize + x]
            let nx = x + shift
            if v != 0 && nx >= 0 && nx < pixieSize { out[ny * pixieSize + nx] = v }
        }
    }
    return out
}
