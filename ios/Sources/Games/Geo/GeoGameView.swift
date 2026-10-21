import SwiftUI

/// Placeholder until the game is built.
struct GeoGameView: View {
    let onExit: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("Geography").font(.largeTitle.weight(.semibold))
            Text("Coming soon.").foregroundStyle(.secondary)
            Button("Back", action: onExit).buttonStyle(.borderedProminent)
            Spacer()
        }
    }
}
