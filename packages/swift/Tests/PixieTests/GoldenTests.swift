import Foundation
import Testing
@testable import Pixie

private func hex(_ n: UInt32) -> String { String(format: "%08x", n) }
private func gridHash(_ g: [UInt8]) -> String { hex(fnv1a(g)) }

@Suite struct GoldenTests {
    /// spec/golden.json is the contract between every implementation.
    @Test func matchesGoldenFile() throws {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("spec/golden.json")
        let data = try Data(contentsOf: url)
        let root = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let entries = try #require(root["entries"] as? [[String: Any]])
        #expect(entries.count == 500)

        var failures = 0
        for e in entries {
            let input = e["input"] as! String
            let s = try generate(input)
            func check<T: Equatable>(_ got: T, _ want: T, _ what: String) {
                if got != want {
                    failures += 1
                    if failures <= 15 { Issue.record("input \(input.debugDescription): \(what) was \(got), golden says \(want)") }
                }
            }
            check(hex(s.seed), e["seed"] as! String, "seed")
            check([s.traits.roundness, s.traits.heft, s.traits.energy, s.traits.chaos, s.traits.slink], e["traits"] as! [Int], "traits")
            check(s.template.rawValue, e["template"] as! String, "template")
            check(s.mark.rawValue, e["mark"] as! String, "mark")
            check(s.eyeStyle.rawValue, e["eyeStyle"] as! String, "eyeStyle")
            check([s.anchors.eyeY, s.anchors.eyeInner, s.anchors.mouthY], e["anchors"] as! [Int], "anchors")
            check(s.colors.dropFirst().joined(separator: ","), e["colors"] as! String, "colors")
            check(gridHash(s.grid), e["grid"] as! String, "grid")
            check(gridHash(s.body), e["body"] as! String, "body")
            let moods = e["moods"] as! [String: String]
            for mood in Mood.allCases {
                check(gridHash(compose(s, Pose(mood: mood))), moods[mood.rawValue]!, "mood \(mood.rawValue)")
            }
            let pose = Pose(mood: .thinking, gaze: Gaze(x: 1, y: -1), blink: true, lift: 2, dx: 1, lean: -2, squash: 1, wave: 3, amp: 1)
            check(gridHash(compose(s, pose)), e["pose"] as! String, "pose")
            check(gridHash(compose(s, Pose(lean: 3, squash: -2))), e["squash"] as! String, "squash")
            check(hex(fnv1a(Array(toSVG(s.grid, colors: s.colors).utf8))), e["svg"] as! String, "svg")
        }
        #expect(failures == 0, "\(failures) golden mismatches")
    }

    /// Replays the scripted inputs from spec/golden.json and compares the pose trace hash.
    @Test func behaviorTracesMatchGolden() throws {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("spec/golden.json")
        let root = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        let behavior = try #require(root["behavior"] as? [String: Any])
        let steps = behavior["steps"] as! Int
        let stepMs = behavior["stepMs"] as! Int
        let script = behavior["script"] as! [[String: Any]]
        let cases = behavior["cases"] as! [[String: Any]]
        #expect(cases.count == 10)

        for c in cases {
            let text = c["text"] as! String
            let sprite = try generate(text)
            let mode: AttentionMode = switch c["attention"] as! String {
            case "always": .always
            case "never": .never
            default: .sometimes
            }
            let b = Behavior(
                seed: sprite.seed, traits: sprite.traits, template: sprite.template, attention: mode,
                reducedMotion: c["reducedMotion"] as! Bool, sleepAfterMs: c["sleepAfterMs"] as! Int
            )
            var trace = ""
            var asleepSteps = 0, blinks = 0, next = 0
            for i in 0..<steps {
                let t = i * stepMs
                while next < script.count && (script[next]["t"] as! Int) <= t {
                    let e = script[next]; next += 1
                    let x = (e["x"] as? NSNumber)?.doubleValue, y = (e["y"] as? NSNumber)?.doubleValue
                    let vec = x.map { Vec(x: $0, y: y ?? 0) }
                    switch e["op"] as! String {
                    case "lookAt": b.lookAt(vec)
                    case "focus": b.focus(vec)
                    case "react": b.react(Mood(rawValue: e["mood"] as! String)!, ms: e["ms"] as! Int)
                    case "setMood": b.setMood((e["mood"] as? String).flatMap(Mood.init(rawValue:)))
                    case "poke": b.poke()
                    case "clearReaction": b.clearReaction()
                    default: Issue.record("unknown op \(e["op"]!)")
                    }
                }
                let p = b.tick(stepMs)
                if b.attention == .asleep { asleepSteps += 1 }
                if p.blink { blinks += 1 }
                trace += "\(p.mood.rawValue),\(p.gaze.x),\(p.gaze.y),\(p.blink ? 1 : 0),\(p.lift),\(p.dx),\(p.lean),\(p.squash),\(p.wave),\(p.amp),\(b.attention.rawValue);"
            }
            #expect(hex(fnv1a(Array(trace.utf8))) == (c["hash"] as! String), "behavior trace for \(text.debugDescription)")
            #expect(asleepSteps == (c["asleepSteps"] as! Int), "asleep steps for \(text.debugDescription)")
            #expect(blinks == (c["blinks"] as! Int), "blinks for \(text.debugDescription)")
        }
    }
}
