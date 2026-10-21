import SwiftUI

/// Placeholder until the game is built.
struct WordsGameView: View {
    let onExit: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("Word scramble").font(.largeTitle.weight(.semibold))
            Text("Coming soon.").foregroundStyle(.secondary)
            Button("Back", action: onExit).buttonStyle(.borderedProminent)
            Spacer()
        }
    }
}
