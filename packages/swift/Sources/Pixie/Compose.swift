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
    let lx = 7 - eyeInner - 2
    let rx = 8 + eyeInner
    for pupilPass in [false, true] {
        for (i, rowString) in pattern.enumerated() {
            let row = Array(rowString)
            for (j, ch) in row.enumerated() {
                if ch == "." { continue }
                let isPupil = ch == "p"
                if pupilPass != isPupil { continue }
                let ox = isPupil ? gx : 0
                let oy = isPupil ? gy : 0
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
        let x0 = 8 - row.count / 2
        for (j, ch) in row.enumerated() where ch != "." {
            if at(g, x0 + j, mouthY + i) != 0 { put(&g, x0 + j, mouthY + i, colorOf[ch] ?? Cell.ink) }
        }
    }

    // Bob: shift everything up one pixel. Row 0 is always empty, so nothing is lost.
    if pose.bob {
        g.replaceSubrange(0..<(pixieSize * (pixieSize - 1)), with: g[pixieSize...])
        for x in 0..<pixieSize { g[pixieSize * (pixieSize - 1) + x] = 0 }
    }

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
