import Foundation

public let pixieSize = 32
/// Last column of the left half. The mascot is mirrored around the line between pixieAxis and pixieAxis + 1.
let pixieAxis = 15
/// Last row of the body. Feet use the rows below it.
let pixieGround = 25
/// First row parts may use. Rows above it hold the outline and leave room for the idle bob.
let pixieTop = 4
/// Most rows a motion may lift the mascot. Rows 0..<pixieTop are always empty, so nothing is lost.
let pixieMaxLift = 3
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

public enum Template: String, Sendable {
    case blob, egg, pear, capsule, dome, cloud, twin, box, mushroom, bell, drop, jelly
    case star, gem, wedge, hex, kite, shield, hourglass
    case serpent, cobra, caterpillar
}

/// A decoration on the body.
public enum Mark: String, Sendable { case none, belly, spots, stripes, cheeks, gem }
public enum EyeStyle: String, Sendable { case dot, big }
public enum PresetName: String, Sendable { case gameboy, mono, amber }

public struct Traits: Equatable, Sendable {
    public var roundness: Int
    public var heft: Int
    public var energy: Int
    public var chaos: Int
    /// Share (0...100) of hissing, slithering letters (s z x h w y l). High values can make a snake.
    public var slink: Int
    public init(roundness: Int, heft: Int, energy: Int, chaos: Int, slink: Int = 0) {
        self.roundness = roundness; self.heft = heft; self.energy = energy; self.chaos = chaos; self.slink = slink
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
    /// Rows the whole mascot is lifted (0...3).
    public var lift: Int
    /// Columns the whole mascot is shifted right (negative = left).
    public var dx: Int
    /// Tilt around the feet: positive leans right at the top (-3...3).
    public var lean: Int
    /// Positive presses the body shorter, negative stretches it taller (-3...3).
    public var squash: Int
    /// Phase (0...7) of a sideways wave that ripples down the body.
    public var wave: Int
    /// Size of that wave in columns (0...2). 0 means none.
    public var amp: Int
    public init(
        mood: Mood = .neutral, gaze: Gaze = Gaze(), blink: Bool = false, lift: Int = 0, dx: Int = 0,
        lean: Int = 0, squash: Int = 0, wave: Int = 0, amp: Int = 0
    ) {
        self.mood = mood; self.gaze = gaze; self.blink = blink; self.lift = lift; self.dx = dx
        self.lean = lean; self.squash = squash; self.wave = wave; self.amp = amp
    }
}

public struct Sprite: Sendable {
    public let version: Int
    public let seed: UInt32
    /// Normalized text this sprite was made from.
    public let text: String
    public let traits: Traits
    public let template: Template
    public let mark: Mark
    public let eyeStyle: EyeStyle
    public let anchors: Anchors
    /// 32x32 palette indices, row by row, without a face.
    public let body: [UInt8]
    /// Body with the neutral face. This is what the golden file hashes.
    public internal(set) var grid: [UInt8]
    /// 8 CSS colors indexed by palette index; index 0 is "" (clear).
    public let colors: [String]
    public let colorName: String

    /// A short description for accessibility.
    public var summary: String {
        let words: [Template: String] = [
            .blob: "round", .egg: "egg-shaped", .pear: "pear-shaped", .capsule: "capsule-shaped", .dome: "dome-shaped",
            .cloud: "cloudy", .twin: "two-part", .box: "boxy", .mushroom: "mushroom-shaped", .bell: "bell-shaped",
            .drop: "drop-shaped", .jelly: "jellyfish-like", .star: "star-shaped", .gem: "crystal-shaped",
            .wedge: "wedge-shaped", .hex: "hexagonal", .kite: "kite-shaped", .shield: "shield-shaped",
            .hourglass: "hourglass-shaped", .serpent: "snake-like", .cobra: "cobra-like", .caterpillar: "caterpillar-like",
        ]
        let shape = words[template] ?? "round"
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
