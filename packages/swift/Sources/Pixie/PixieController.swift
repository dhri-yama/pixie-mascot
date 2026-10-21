#if canImport(SwiftUI)
import SwiftUI

/// Owns a mascot's sprite and behavior. Create one when you want to drive the mascot from code
/// (`react`, `poke`, `setMood`) or share it with `pixieTarget`; otherwise `PixieView` makes its own.
@MainActor
public final class PixieController: ObservableObject {
    @Published public private(set) var sprite: Sprite
    private var behavior: Behavior
    private var settings: Settings
    private var appMood: Mood?
    private var lastTick: Date?
    private var leftover = 0.0
    /// Center of the mascot in global coordinates, reported by the view.
    var center: CGPoint?
    #if canImport(AppKit)
    weak var probe: NSView?
    #endif

    private struct Settings: Equatable {
        var text: String
        var palette: PresetName?
        var attention: AttentionMode
        var reducedMotion: Bool
        var sleepAfterMs: Int
    }

    public init(text: String, palette: PresetName? = nil, attention: AttentionMode = .sometimes, reducedMotion: Bool = false, sleepAfterMs: Int = 30000) {
        let s = Settings(text: text, palette: palette, attention: attention, reducedMotion: reducedMotion, sleepAfterMs: sleepAfterMs)
        settings = s
        let sprite = Self.makeSprite(s)
        self.sprite = sprite
        behavior = Self.makeBehavior(sprite, s)
    }

    private static func makeSprite(_ s: Settings) -> Sprite {
        // Version 1 is always supported, so this cannot throw.
        (try? generate(s.text, palette: s.palette)) ?? (try! generate("", palette: s.palette))
    }

    private static func makeBehavior(_ sprite: Sprite, _ s: Settings) -> Behavior {
        Behavior(seed: sprite.seed, traits: sprite.traits, template: sprite.template, attention: s.attention, reducedMotion: s.reducedMotion, sleepAfterMs: s.sleepAfterMs)
    }

    /// Apply new settings. Only rebuilds the sprite or behavior when something changed.
    func configure(text: String, palette: PresetName?, attention: AttentionMode, reducedMotion: Bool, mood: Mood?) {
        var s = settings
        s.text = text; s.palette = palette; s.attention = attention; s.reducedMotion = reducedMotion
        if s != settings {
            let rebuildSprite = s.text != settings.text || s.palette != settings.palette
            let rebuildBehavior = rebuildSprite || s.reducedMotion != settings.reducedMotion
            settings = s
            if rebuildSprite { sprite = Self.makeSprite(s) }
            if rebuildBehavior {
                behavior = Self.makeBehavior(sprite, s)
                behavior.setMood(appMood)
            } else {
                behavior.setAttention(attention)
            }
        }
        if mood != appMood { setMood(mood) }
    }

    public func setMood(_ mood: Mood?) {
        appMood = mood
        behavior.setMood(mood)
    }

    public func react(_ mood: Mood, ms: Int = 900) { behavior.react(mood, ms: ms) }
    public func poke() { behavior.poke() }

    /// Look at a point in global coordinates, or pass nil to stop.
    public func look(at point: CGPoint?) {
        guard let point, let c = center else { behavior.lookAt(nil); return }
        behavior.lookAt(Vec(x: Double(point.x - c.x) / 200, y: Double(point.y - c.y) / 200))
    }

    func focus(on point: CGPoint?) {
        guard let point, let c = center else { behavior.focus(nil); return }
        behavior.focus(Vec(x: Double(point.x - c.x) / 200, y: Double(point.y - c.y) / 200))
    }

    /// Called by the view each frame. Advances the behavior by the real time since the last call.
    func tick(now: Date) -> Pose {
        #if canImport(AppKit)
        if settings.attention != .never, let v = pointerVector() { behavior.lookAt(v) }
        #endif
        guard let last = lastTick else {
            lastTick = now
            return behavior.tick(0)
        }
        lastTick = now
        let ms = now.timeIntervalSince(last) * 1000 + leftover
        let whole = Int(min(ms, 1000))
        leftover = ms - Double(whole)
        return behavior.tick(whole)
    }

    #if canImport(AppKit)
    /// The system pointer relative to the mascot, in the same units as `Vec`. Works anywhere in the window.
    private func pointerVector() -> Vec? {
        guard let view = probe, let window = view.window else { return nil }
        let p = view.convert(window.mouseLocationOutsideOfEventStream, from: nil)
        guard view.bounds.insetBy(dx: -4000, dy: -4000).contains(p) else { return nil }
        let dy = view.isFlipped ? p.y - view.bounds.midY : view.bounds.midY - p.y
        return Vec(x: Double(p.x - view.bounds.midX) / 200, y: Double(dy) / 200)
    }
    #endif
}
#endif
