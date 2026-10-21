import Foundation

public let pixieSize = 16
public let pixieVersion = 1

/// Palette indices used in grids.
enum Cell {
    static let clear: UInt8 = 0, body: UInt8 = 1, outline: UInt8 = 2, shade: UInt8 = 3
    static let light: UInt8 = 4, accent: UInt8 = 5, ink: UInt8 = 6, white: UInt8 = 7
}

public enum Mood: String, CaseIterable, Sendable {
    case neutral, happy, sad, surprised, thinking, sleepy

    /// Friendly names for moods the sprite sheet does not have yet.
    public init?(named name: String?) {
        guard let name else { return nil }
        if let m = Mood(rawValue: name) { self = m; return }
        let alias: [String: Mood] = [
            "worried": .sad, "angry": .sad, "excited": .happy, "love": .happy,
            "smug": .happy, "confused": .thinking, "shy": .sleepy,
        ]
        guard let m = alias[name] else { return nil }
        self = m
    }
}

public enum Template: String, Sendable { case blob, box, wedge, gem }
public enum EyeStyle: String, Sendable { case dot, big }
public enum PresetName: String, Sendable { case gameboy, mono, amber }

public struct Traits: Equatable, Sendable {
    public var roundness: Int
    public var heft: Int
    public var energy: Int
    public var chaos: Int
    public init(roundness: Int, heft: Int, energy: Int, chaos: Int) {
        self.roundness = roundness; self.heft = heft; self.energy = energy; self.chaos = chaos
    }
}

public struct Anchors: Equatable, Sendable {
    public var eyeY: Int
    public var eyeInner: Int
    public var mouthY: Int
}

/// -1, 0 or 1 on each axis.
public struct Gaze: Equatable, Sendable {
    public var x: Int
    public var y: Int
    public init(x: Int = 0, y: Int = 0) { self.x = x; self.y = y }
}

public struct Pose: Equatable, Sendable {
    public var mood: Mood
    public var gaze: Gaze
    public var blink: Bool
    /// Shift the whole mascot up one pixel (idle bob).
    public var bob: Bool
    public init(mood: Mood = .neutral, gaze: Gaze = Gaze(), blink: Bool = false, bob: Bool = false) {
        self.mood = mood; self.gaze = gaze; self.blink = blink; self.bob = bob
    }
}

public struct Sprite: Sendable {
    public let version: Int
    public let seed: UInt32
    /// Normalized text this sprite was made from.
    public let text: String
    public let traits: Traits
    public let template: Template
    public let eyeStyle: EyeStyle
    public let anchors: Anchors
    /// 16x16 palette indices, row by row, without a face.
    public let body: [UInt8]
    /// Body with the neutral face. This is what the golden file hashes.
    public internal(set) var grid: [UInt8]
    /// 8 CSS colors indexed by palette index; index 0 is "" (clear).
    public let colors: [String]
    public let colorName: String

    /// A short description for accessibility.
    public var summary: String {
        let shape: String
        switch template {
        case .blob: shape = "round"
        case .box: shape = "boxy"
        case .wedge: shape = "wedge-shaped"
        case .gem: shape = "crystal-shaped"
        }
        let e = traits.energy
        let mood = e < 35 ? "calm" : e < 65 ? "lively" : "hyper"
        return "A \(shape), \(mood) \(colorName) pixel mascot"
    }
}

func at(_ g: [UInt8], _ x: Int, _ y: Int) -> Int {
    x < 0 || y < 0 || x >= pixieSize || y >= pixieSize ? 0 : Int(g[y * pixieSize + x])
}

func put(_ g: inout [UInt8], _ x: Int, _ y: Int, _ v: UInt8) {
    if x >= 0 && y >= 0 && x < pixieSize && y < pixieSize { g[y * pixieSize + x] = v }
}

func clamp(_ v: Int, _ lo: Int = 0, _ hi: Int = 100) -> Int { v < lo ? lo : v > hi ? hi : v }
