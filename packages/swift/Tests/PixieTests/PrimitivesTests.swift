import Foundation
import Testing
@testable import Pixie

@Suite struct PrimitivesTests {
    @Test func fnvVectors() {
        #expect(fnv1a([]) == 0x811c9dc5)
        #expect(fnv1a(Array("a".utf8)) == 0xe40c292c)
        #expect(fnv1a(Array("foobar".utf8)) == 0xbf9cf968)
    }

    @Test func rngVectors() {
        let r = Rng(seed: 1)
        #expect([r.next(), r.next(), r.next()] == [2693262067, 11749833, 2265367787])
    }

    @Test func normalizeRules() {
        #expect(normalize("  Bubba \t\n Bubba  ") == "bubba bubba")
        #expect(normalize("caf\u{e9}") == normalize("cafe\u{301}"))
        #expect(normalize("\u{c9}") == "\u{c9}")
        #expect(normalize("   ") == "")
        #expect(normalize(String(repeating: "\u{1F600}", count: 200)).unicodeScalars.count == 128)
    }

    @Test func generateBasics() throws {
        let a = try generate("bubbanbbebb")
        let b = try generate("  Bubbanbbebb ")
        #expect(a.grid == b.grid)
        #expect(a.grid.count == pixieSize * pixieSize)
        #expect(a.grid.allSatisfy { $0 <= 7 })
        #expect(Array(a.body[0..<(pixieSize * pixieBob)]) == [UInt8](repeating: 0, count: pixieSize * pixieBob))
        #expect(a.traits.roundness > 80)
        #expect(try generate("jsakkkwaakiyy").traits.roundness < 40)
        #expect(throws: GenerateError.self) { try generate("x", version: 99) }
        #expect(try generate("bubba", palette: .gameboy).colors[1] == "#8bac0f")
        #expect(a.summary.hasPrefix("A "))
    }

    @Test func neverCrashesOnOddInput() throws {
        var rng = SystemRandomNumberGenerator()
        for _ in 0..<500 {
            var s = ""
            for _ in 0..<Int.random(in: 0..<40, using: &rng) {
                if let u = Unicode.Scalar(UInt32.random(in: 0..<0x2FFFF, using: &rng)) { s.unicodeScalars.append(u) }
            }
            let sprite = try generate(s)
            #expect(sprite.grid.count == pixieSize * pixieSize)
            for mood in Mood.allCases { #expect(compose(sprite, Pose(mood: mood, blink: true, bob: true)).count == pixieSize * pixieSize) }
        }
    }
}
