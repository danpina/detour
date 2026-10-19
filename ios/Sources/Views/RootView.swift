import SwiftUI

/// First native screen: proves the bundled content loads and decodes on a real device.
/// The real experience (onboarding, sessions, recall) is built on top of this in later steps.
struct RootView: View {
    private let content = ContentStore.load()

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("\(content.cards.count) cards bundled")
                        .font(.headline)
                    ForEach(content.issues, id: \.self) { issue in
                        Text(issue).font(.footnote).foregroundStyle(.red)
                    }
                }
                Section("Cards") {
                    ForEach(content.cards) { card in
                        HStack(spacing: 12) {
                            if let image = ContentStore.image(for: card, root: content.root) {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 44, height: 55)
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(card.title).font(.subheadline.weight(.medium))
                                Text("\(card.interest.displayName) · \(card.type)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Detour")
        }
    }
}
