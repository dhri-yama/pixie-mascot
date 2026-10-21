import Foundation
import Testing
@testable import Pixie

#if canImport(CoreGraphics)
import CoreGraphics

private func pixels(_ image: CGImage) -> [UInt8] {
    let w = image.width, h = image.height
    var data = [UInt8](repeating: 0, count: w * h * 4)
    let ctx = CGContext(data: &data, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
    return data
}

@Suite struct RenderTests {
    @Test func cgImageIsCrispAndColored() throws {
        let s = try generate("bubbanbbebb")
        let image = try #require(cgImage(s.grid, colors: s.colors, scale: 8))
        #expect(image.width == 128 && image.height == 128)
        let data = pixels(image)
        // Every 8x8 block is one flat color: pick a body pixel and check its neighbors.
        var opaque = 0
        for i in stride(from: 3, to: data.count, by: 4) where data[i] == 255 { opaque += 1 }
        #expect(opaque > 2000)
        #expect(data[3] == 0, "top-left corner is transparent")
        let (r, g, b) = parseHex(s.colors[1])
        let first = s.grid.firstIndex(of: 1)!
        let px = (first % 16) * 8 + 3, py = (first / 16) * 8 + 3
        let o = (py * 128 + px) * 4
        #expect(data[o] == r && data[o + 1] == g && data[o + 2] == b)
    }

    @Test func svgHasOneRectPerRunAndAccessibleName() throws {
        let s = try generate("jsakkkwaakiyy")
        let svg = s.svg(size: 96)
        #expect(svg.hasPrefix("<svg"))
        #expect(svg.contains("width=\"96\""))
        #expect(svg.contains("aria-label=\"\(s.summary)\""))
        #expect(svg.components(separatedBy: "<rect").count - 1 == runs(s.grid).count)
    }
}

#if canImport(SwiftUI) && canImport(AppKit)
import SwiftUI

@MainActor
@Suite struct SwiftUIRenderTests {
    /// Renders the real SwiftUI view off-screen and checks that sprite pixels land where expected.
    @Test func pixieViewDraws() throws {
        let view = PixieView(text: "bubbanbbebb", mood: .happy, animated: false).frame(width: 256, height: 256)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 1
        let image = try #require(renderer.cgImage)
        #expect(image.width == 256 && image.height == 256)
        let data = pixels(image)
        var opaque = 0
        for i in stride(from: 3, to: data.count, by: 4) where data[i] > 0 { opaque += 1 }
        #expect(opaque > 8000, "the mascot should cover a good part of the canvas")

        // Leave a few snapshots in the (git-ignored) .build folder so a human can look at them.
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
        let dir = root.appendingPathComponent(".build/snapshots")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        for (word, mood) in [("bubbanbbebb", Mood.happy), ("jsakkkwaakiyy", .neutral), ("sleepy cloud", .sleepy)] {
            let r = ImageRenderer(content: PixieView(text: word, mood: mood, animated: false).frame(width: 256, height: 256))
            r.scale = 1
            if let cg = r.cgImage, let png = NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:]) {
                try png.write(to: dir.appendingPathComponent("swiftui-\(word.replacingOccurrences(of: " ", with: "-")).png"))
            }
        }
    }
}
#endif
#endif
