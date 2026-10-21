import SwiftUI

struct OnboardingView: View {
    @State private var picked: [Interest]
    let onDone: ([Interest]) -> Void
    /// "Show me a quick one" the first time; "Save" when editing topics from Settings.
    let confirmLabel: String
    private let minimum = 3

    init(initial: [Interest], confirmLabel: String = "Show me a quick one", onDone: @escaping ([Interest]) -> Void) {
        _picked = State(initialValue: initial)
        self.confirmLabel = confirmLabel
        self.onDone = onDone
    }

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    private func emoji(_ i: Interest) -> String {
        switch i {
        case .history: return "🏛️"
        case .science: return "🔭"
        case .money: return "🪙"
        case .tech: return "💡"
        case .mind: return "🧠"
        case .numbers: return "🔢"
        case .estimation: return "⚖️"
        }
    }

    private func blurb(_ i: Interest) -> String {
        switch i {
        case .history: return "Stories that still echo"
        case .science: return "How the world works"
        case .money: return "Ideas behind the numbers"
        case .tech: return "How we got here"
        case .mind: return "Why we think what we think"
        case .numbers: return "Patterns and puzzles"
        case .estimation: return "Guess big numbers"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Detour").font(.subheadline.weight(.medium)).foregroundStyle(.tint)
            Text("What are you curious about?")
                .font(.largeTitle.weight(.semibold))
                .padding(.top, 8)
            Text("Pick at least \(minimum). You can change this any time.")
                .foregroundStyle(.secondary)
                .padding(.top, 6)

            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(Interest.allCases, id: \.self) { interest in
                        let on = picked.contains(interest)
                        Button {
                            if on { picked.removeAll { $0 == interest } } else { picked.append(interest) }
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(emoji(interest)).font(.title)
                                Text(interest.displayName).font(.headline)
                                Text(blurb(interest)).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.leading)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(on ? Color.accentColor.opacity(0.15) : Color(.secondarySystemBackground))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(on ? Color.accentColor : Color.clear, lineWidth: 2))
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(on ? .isSelected : [])
                    }
                }
                .padding(.top, 20)
            }

            Button {
                onDone(picked)
            } label: {
                Text(picked.count >= minimum ? confirmLabel : "Pick \(minimum - picked.count) more")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            }
            .buttonStyle(.borderedProminent)
            .disabled(picked.count < minimum)
        }
        .padding(24)
    }
}
