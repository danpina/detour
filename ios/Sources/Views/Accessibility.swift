import SwiftUI

/// A fixed point size that still follows the player's text size setting (Dynamic Type), growing and shrinking like `style`.
private struct ScaledFont: ViewModifier {
    @ScaledMetric private var size: CGFloat
    private let weight: Font.Weight
    private let monospaced: Bool

    init(size: CGFloat, weight: Font.Weight, style: Font.TextStyle, monospaced: Bool) {
        _size = ScaledMetric(wrappedValue: size, relativeTo: style)
        self.weight = weight
        self.monospaced = monospaced
    }

    func body(content: Content) -> some View {
        let font = Font.system(size: size, weight: weight)
        content.font(monospaced ? font.monospacedDigit() : font)
    }
}

extension View {
    /// Like `.font(.system(size:weight:))`, but scales with the text size setting. Use it for text people read, not for decoration.
    func scaledFont(_ size: CGFloat, weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body, monospaced: Bool = false) -> some View {
        modifier(ScaledFont(size: size, weight: weight, style: style, monospaced: monospaced))
    }
}
