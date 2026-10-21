import Foundation

// Spec: spec/sprite.md "Output". Integer coordinates and hex colors only, so output is stable.

public struct Run: Equatable, Sendable {
    public let x: Int, y: Int, w: Int
    /// Palette index, never 0.
    public let idx: Int
}

/// Horizontal runs of equal, non-clear cells. Fewer rects than one per pixel.
public func runs(_ grid: [UInt8]) -> [Run] {
    var out: [Run] = []
    for y in 0..<pixieSize {
        var x = 0
        while x < pixieSize {
            let idx = Int(grid[y * pixieSize + x])
            if idx == 0 { x += 1; continue }
            var w = 1
            while x + w < pixieSize && Int(grid[y * pixieSize + x + w]) == idx { w += 1 }
            out.append(Run(x: x, y: y, w: w, idx: idx))
            x += w
        }
    }
    return out
}

private func escapeXML(_ s: String) -> String {
    s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
        .replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;")
}

/// SVG markup identical to the TypeScript core's `toSVG`. Pass a nil or empty label for a decorative image.
public func toSVG(_ grid: [UInt8], colors: [String], size: Int? = nil, label: String? = nil) -> String {
    let dim = size.map { " width=\"\($0)\" height=\"\($0)\"" } ?? ""
    let a11y = (label == nil || label == "") ? " aria-hidden=\"true\"" : " role=\"img\" aria-label=\"\(escapeXML(label!))\""
    let rects = runs(grid).map { r in
        "<rect x=\"\(r.x)\" y=\"\(r.y)\" width=\"\(r.w)\" height=\"1\" fill=\"\(r.idx < colors.count ? colors[r.idx] : "#000")\"/>"
    }.joined()
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 \(pixieSize) \(pixieSize)\"\(dim) shape-rendering=\"crispEdges\"\(a11y)>\(rects)</svg>"
}

/// "#rrggbb" -> (r, g, b) in 0...255. Unknown input gives black.
func parseHex(_ s: String) -> (UInt8, UInt8, UInt8) {
    let h = s.hasPrefix("#") ? String(s.dropFirst()) : s
    guard h.count == 6, let v = UInt32(h, radix: 16) else { return (0, 0, 0) }
    return (UInt8((v >> 16) & 255), UInt8((v >> 8) & 255), UInt8(v & 255))
}

#if canImport(CoreGraphics)
import CoreGraphics

/// Crisp bitmap of a grid: `scale` pixels per sprite pixel, nearest-neighbor, transparent background.
public func cgImage(_ grid: [UInt8], colors: [String], scale: Int = 8) -> CGImage? {
    let side = pixieSize * scale
    var rgba = [UInt8](repeating: 0, count: side * side * 4)
    let palette = colors.map(parseHex)
    for y in 0..<side {
        for x in 0..<side {
            let idx = Int(grid[(y / scale) * pixieSize + (x / scale)])
            if idx == 0 || idx >= palette.count { continue }
            let o = (y * side + x) * 4
            rgba[o] = palette[idx].0; rgba[o + 1] = palette[idx].1; rgba[o + 2] = palette[idx].2; rgba[o + 3] = 255
        }
    }
    guard let provider = CGDataProvider(data: Data(rgba) as CFData) else { return nil }
    return CGImage(
        width: side, height: side, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: side * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
        provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent
    )
}
#endif

extension Sprite {
    /// This sprite with the given pose, drawn into a new grid.
    public func grid(for pose: Pose) -> [UInt8] { compose(self, pose) }
    /// Static SVG of the sprite in a pose.
    public func svg(pose: Pose = Pose(), size: Int? = nil) -> String {
        toSVG(compose(self, pose), colors: colors, size: size, label: summary)
    }
}
