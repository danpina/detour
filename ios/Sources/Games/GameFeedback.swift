import SwiftUI
// Small shared pieces for the multiple-choice games (progress bar, haptics, pop).

/// A thin bar showing how far through the round the player is.
struct GameProgressBar: View {
    let done: Int
    let total: Int

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.secondary.opacity(0.2))
                Capsule().fill(Color.accentColor)
                    .frame(width: total > 0 ? geo.size.width * CGFloat(min(done, total)) / CGFloat(total) : 0)
                    .animation(.easeOut(duration: 0.3), value: done)
            }
        }
        .frame(height: 4)
        .accessibilityHidden(true)
    }
}

/// The pop for the right answer. With Reduce Motion on, nothing moves.
private struct AnswerPop: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let on: Bool

    func body(content: Content) -> some View {
        content
            .scaleEffect(on && !reduceMotion ? 1.03 : 1)
            .animation(reduceMotion ? nil : .spring(duration: 0.3), value: on)
    }
}

extension View {
    /// A small tap on a right or wrong answer: a soft "success" or "error" haptic when the answer is picked.
    func answerHaptic(picked: Bool, correct: Bool) -> some View {
        sensoryFeedback(trigger: picked ? (correct ? 1 : 2) : 0) { _, new in
            switch new {
            case 1: return .success
            case 2: return .error
            default: return nil
            }
        }
    }

    /// The right answer pops a little once the answer is in.
    func answerPop(_ on: Bool) -> some View {
        modifier(AnswerPop(on: on))
    }
}
