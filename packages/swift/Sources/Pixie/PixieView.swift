#if canImport(SwiftUI)
import SwiftUI

extension Color {
    init(pixieHex hex: String) {
        let c = parseHex(hex)
        self.init(.sRGB, red: Double(c.0) / 255, green: Double(c.1) / 255, blue: Double(c.2) / 255, opacity: 1)
    }
}

/// A pixel mascot made from `text`. Same text, same mascot, on every platform.
///
///     PixieView(text: user.name).frame(width: 96, height: 96)
///     PixieView(text: "helper", mood: isLoading ? .thinking : .happy)
public struct PixieView: View {
    @StateObject private var owned: PixieController
    private let external: PixieController?
    private let text: String
    private let mood: Mood?
    private let palette: PresetName?
    private let animated: Bool
    private let attention: AttentionMode
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// - Parameters:
    ///   - mood: A mood set by your app. nil lets the mascot decide.
    ///   - animated: false draws one still frame.
    ///   - attention: always / sometimes / never follow the pointer or touch.
    ///   - controller: Share a controller to call `react` / `poke`, or to use `pixieTarget`.
    public init(
        text: String, mood: Mood? = nil, palette: PresetName? = nil, animated: Bool = true,
        attention: AttentionMode = .sometimes, controller: PixieController? = nil
    ) {
        self.text = text; self.mood = mood; self.palette = palette
        self.animated = animated; self.attention = attention; external = controller
        _owned = StateObject(wrappedValue: PixieController(text: text, palette: palette, attention: attention))
    }

    private var controller: PixieController { external ?? owned }

    public var body: some View {
        let c = controller
        Group {
            if animated {
                TimelineView(.periodic(from: .now, by: 0.1)) { context in
                    PixieCanvas(sprite: c.sprite, pose: c.tick(now: context.date))
                }
            } else {
                PixieCanvas(sprite: c.sprite, pose: Pose(mood: mood ?? .neutral))
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .background {
            // Only animated mascots need to know where they are (still ones can be rendered off-screen).
            if animated { PixieProbe(controller: c) }
        }
        .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .global)
                .onChanged { c.look(at: $0.location) }
                .onEnded { _ in
                    c.look(at: nil)
                    c.poke()
                },
            including: animated ? .all : .none
        )
        .onAppear { configure() }
        .onChange(of: text) { _ in configure() }
        .onChange(of: palette) { _ in configure() }
        .onChange(of: mood) { _ in configure() }
        .onChange(of: attention) { _ in configure() }
        .onChange(of: reduceMotion) { _ in configure() }
        .accessibilityElement()
        .accessibilityLabel(c.sprite.summary)
        .accessibilityAddTraits(.isImage)
    }

    private func configure() {
        controller.configure(text: text, palette: palette, attention: attention, reducedMotion: reduceMotion, mood: mood)
    }
}

/// Draws a grid as crisp, non-antialiased squares.
struct PixieCanvas: View {
    let sprite: Sprite
    let pose: Pose

    var body: some View {
        let grid = compose(sprite, pose)
        let colors = sprite.colors.map { Color(pixieHex: $0) }
        Canvas { context, size in
            let cell = min(size.width, size.height) / CGFloat(pixieSize)
            let ox = (size.width - cell * CGFloat(pixieSize)) / 2
            let oy = (size.height - cell * CGFloat(pixieSize)) / 2
            for run in runs(grid) where run.idx < colors.count {
                let x0 = (ox + CGFloat(run.x) * cell).rounded()
                let x1 = (ox + CGFloat(run.x + run.w) * cell).rounded()
                let y0 = (oy + CGFloat(run.y) * cell).rounded()
                let y1 = (oy + CGFloat(run.y + 1) * cell).rounded()
                context.fill(
                    Path(CGRect(x: x0, y: y0, width: x1 - x0, height: y1 - y0)),
                    with: .color(colors[run.idx]), style: FillStyle(antialiased: false)
                )
            }
        }
    }
}

/// Reports the view's position to the controller (and, on macOS, lets it read the system pointer).
struct PixieProbe: View {
    let controller: PixieController

    var body: some View {
        GeometryReader { geo in
            let frame = geo.frame(in: .global)
            ZStack {
                Color.clear
                #if canImport(AppKit)
                PixieProbeView(controller: controller)
                #endif
            }
            .onAppear { controller.center = CGPoint(x: frame.midX, y: frame.midY) }
            .onChange(of: frame) { controller.center = CGPoint(x: $0.midX, y: $0.midY) }
        }
    }
}

#if canImport(AppKit)
import AppKit
struct PixieProbeView: NSViewRepresentable {
    let controller: PixieController
    func makeNSView(context: Context) -> NSView {
        let v = NSView()
        controller.probe = v
        return v
    }
    func updateNSView(_ nsView: NSView, context: Context) { controller.probe = nsView }
}
#endif

// MARK: - Making the UI around a mascot matter to it

/// Remembers where the target is without triggering redraws.
private final class TargetBox: ObservableObject {
    var center: CGPoint?
}

private struct PixieTarget: ViewModifier {
    let controller: PixieController
    let mood: Mood?
    @StateObject private var box = TargetBox()

    func body(content: Content) -> some View {
        content
            .background(GeometryReader { geo in
                let frame = geo.frame(in: .global)
                Color.clear
                    .onAppear { box.center = CGPoint(x: frame.midX, y: frame.midY) }
                    .onChange(of: frame) { box.center = CGPoint(x: $0.midX, y: $0.midY) }
            })
            .onHover { inside in
                if inside {
                    controller.focus(on: box.center)
                    if let mood { controller.react(mood, ms: 600_000) }
                } else {
                    controller.focus(on: nil)
                    controller.setMood(nil)
                }
            }
            .simultaneousGesture(TapGesture().onEnded { controller.react(mood ?? .happy, ms: 900) })
    }
}

extension View {
    /// Make a mascot notice this view: it looks at it on hover and reacts when it is tapped.
    ///
    ///     Button("Delete") { ... }.pixieTarget(pixie, mood: .sad)
    public func pixieTarget(_ controller: PixieController, mood: Mood? = nil) -> some View {
        modifier(PixieTarget(controller: controller, mood: mood))
    }
}
#endif
