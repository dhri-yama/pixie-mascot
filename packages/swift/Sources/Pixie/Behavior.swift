import Foundation

// Spec: spec/behavior.md. Pure, seeded state machine: no clock, no system randomness.
// The host calls tick(dtMs) about 10 times a second and draws the returned Pose with compose().

public enum Attention: String, Sendable { case follow, wander, focus, asleep }
public enum AttentionMode: Sendable { case always, sometimes, never }

/// A direction from the mascot to something. Length about 1 means "far away".
public struct Vec: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public init(x: Double, y: Double) { self.x = x; self.y = y }
}

/// Turn a direction into one of 8 gaze directions (or center). The deadzone keeps small offsets still.
public func snapGaze(_ v: Vec, deadzone: Double = 0.3) -> Gaze {
    func f(_ n: Double) -> Int { n > deadzone ? 1 : n < -deadzone ? -1 : 0 }
    return Gaze(x: f(v.x), y: f(v.y))
}

private let wanderGazes: [Gaze] = [
    Gaze(x: -1, y: 0), Gaze(x: 1, y: 0), Gaze(x: 0, y: -1), Gaze(x: 0, y: 1),
    Gaze(x: -1, y: -1), Gaze(x: 1, y: -1), Gaze(x: -1, y: 1), Gaze(x: 1, y: 1), Gaze(x: 0, y: 0),
]

public final class Behavior {
    private let traits: Traits
    private let rng: Rng
    private let reduced: Bool
    private let sleepAfter: Int
    private var mode: AttentionMode

    private let blinkMin: Int
    private let bobHalf: Int
    private let gazeDelay: Int
    private let span: Int
    private let phase: Int

    private var now = 0
    private var lastActivity = 0
    private var asleep = false
    private var appMood: Mood?
    private var reaction: (mood: Mood, until: Int)?
    private var target: Vec?
    private var focusTarget: Vec?
    public private(set) var attention: Attention = .follow
    private var attentionUntil: Int
    private var wanderGaze = Gaze()
    private var wanderAt = 0
    private var gaze = Gaze()
    private var gazeAt = 0
    private var nextBlink: Int
    private var blinkUntil = -1
    public private(set) var mood: Mood = .neutral

    /// sleepAfterMs 0 never sleeps. Use the sprite's seed and traits so each mascot has its own rhythm.
    public init(seed: UInt32, traits: Traits, attention: AttentionMode = .sometimes, reducedMotion: Bool = false, sleepAfterMs: Int = 30000) {
        self.traits = traits
        rng = Rng(seed: seed ^ 0x9e3779b9)
        reduced = reducedMotion
        sleepAfter = sleepAfterMs
        mode = attention
        blinkMin = 6000 - traits.energy * 30
        bobHalf = clamp(700 - traits.energy * 4, 250, 700)
        gazeDelay = 80 + (100 - traits.energy) * 2
        span = 3000 + (100 - traits.chaos) * 40
        // Draw order matters: phase, attention span, first blink.
        phase = rng.int(bobHalf * 2)
        attentionUntil = 0 + span + rng.int(3000)
        nextBlink = blinkMin + rng.int(2500)
    }

    private func touch() {
        lastActivity = now
        asleep = false
    }

    public func setMood(_ m: Mood?) {
        appMood = m
        if m != nil { touch() }
    }

    public func react(_ m: Mood, ms: Int = 900) {
        reaction = (m, now + ms)
        touch()
    }

    public func clearReaction() { reaction = nil }

    public func lookAt(_ v: Vec?) {
        var moved = false
        if let v { moved = target == nil || abs(v.x - target!.x) + abs(v.y - target!.y) > 0.05 }
        target = v
        if moved { touch() }
    }

    public func focus(_ v: Vec?) {
        focusTarget = v
        if v != nil { touch() }
    }

    public func poke() {
        reaction = (.surprised, now + 700)
        touch()
    }

    public func setAttention(_ m: AttentionMode) { mode = m }

    private func chooseAttention() {
        if asleep { attention = .asleep; return }
        if focusTarget != nil { attention = .focus; return }
        // Nothing to follow, or told not to: just look around.
        if mode == .never || target == nil { attention = .wander; return }
        if mode == .always || reduced { attention = .follow; return }
        // Cursor present, mode sometimes: alternate between following and glancing away.
        if attention != .follow && attention != .wander {
            attention = .follow
            attentionUntil = now + span + rng.int(3000)
        } else if now >= attentionUntil {
            if attention == .follow {
                attention = .wander
                attentionUntil = now + 1500 + rng.int(2500)
                wanderAt = now
                wanderGaze = wanderGazes[rng.int(wanderGazes.count)]
            } else {
                attention = .follow
                attentionUntil = now + span + rng.int(3000)
            }
        }
    }

    /// Advance time by `dtMs` milliseconds and return the pose to draw.
    public func tick(_ dtMs: Int) -> Pose {
        now += max(0, dtMs)
        if sleepAfter > 0 && !asleep && appMood == nil && now - lastActivity >= sleepAfter { asleep = true }
        if let r = reaction, now >= r.until { reaction = nil }

        chooseAttention()
        // While wandering, pick a new glance every couple of seconds.
        if attention == .wander && !reduced && now - wanderAt >= 1500 + traits.chaos * 20 {
            wanderAt = now
            wanderGaze = wanderGazes[rng.int(wanderGazes.count)]
        }

        if now - gazeAt >= gazeDelay {
            gazeAt = now
            if attention == .asleep { gaze = Gaze() }
            else if attention == .focus, let f = focusTarget { gaze = snapGaze(f) }
            else if attention == .follow, let t = target { gaze = snapGaze(t) }
            else if attention == .wander && !reduced { gaze = wanderGaze }
            else { gaze = Gaze() }
        }

        mood = appMood ?? reaction?.mood ?? (asleep ? .sleepy : .neutral)

        var blink = false
        if !reduced && mood != .sleepy {
            if now >= nextBlink {
                blinkUntil = now + 140
                nextBlink = now + blinkMin + rng.int(2500)
            }
            blink = now < blinkUntil
        }

        let half = asleep ? bobHalf * 3 : bobHalf
        let bob = !reduced && ((now + phase) / half) % 2 == 1

        return Pose(mood: mood, gaze: gaze, blink: blink, bob: bob)
    }
}
