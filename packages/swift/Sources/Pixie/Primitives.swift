import Foundation

// Spec: spec/sprite.md. Normalization, FNV-1a hash, mulberry32. Must match the TypeScript core bit for bit.

private func isSpace(_ c: UInt32) -> Bool {
    (c >= 0x09 && c <= 0x0d) || c == 0x20 || c == 0xa0 || (c >= 0x2000 && c <= 0x200a)
        || c == 0x2028 || c == 0x2029 || c == 0x202f || c == 0x205f || c == 0x3000
}

/// NFC, ASCII-only lowercase, whitespace runs become one space, trimmed, capped at 128 code points.
public func normalize(_ text: String) -> String {
    var out: [UInt32] = []
    var pending = false
    for scalar in text.precomposedStringWithCanonicalMapping.unicodeScalars {
        var c = scalar.value
        if isSpace(c) {
            pending = !out.isEmpty
            continue
        }
        if pending {
            out.append(0x20)
            pending = false
        }
        if c >= 65 && c <= 90 { c += 32 }
        out.append(c)
    }
    var capped = Array(out.prefix(128))
    if capped.last == 0x20 { capped.removeLast() }
    var view = String.UnicodeScalarView()
    for c in capped { view.append(Unicode.Scalar(c) ?? "\u{FFFD}") }
    return String(view)
}

public func fnv1a(_ bytes: [UInt8]) -> UInt32 {
    var h: UInt32 = 0x811c9dc5
    for b in bytes {
        h ^= UInt32(b)
        h = h &* 0x01000193
    }
    return h
}

public func hashText(_ normalized: String) -> UInt32 {
    fnv1a(Array(normalized.utf8))
}

/// mulberry32 returning uint32. The order of calls is part of the algorithm.
public final class Rng {
    private var a: UInt32

    public init(seed: UInt32) { a = seed }

    public func next() -> UInt32 {
        a = a &+ 0x6d2b79f5
        var t = (a ^ (a >> 15)) &* (1 | a)
        t = (t &+ ((t ^ (t >> 7)) &* (61 | t))) ^ t
        return t ^ (t >> 14)
    }

    /// Integer in [0, n).
    public func int(_ n: Int) -> Int { Int(next()) % n }
}
