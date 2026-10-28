import SwiftUI

/// "Pick something specific": a round of one topic's cards, only the cards due for review, or one math skill.
struct PickView: View {
    @Environment(AppModel.self) private var model
    let start: (_ specific: AppModel.Specific, _ kind: AppModel.RoundKind) -> Void
    let openGames: () -> Void

    private enum Part: Hashable { case cards, math, games }
    @State private var part: Part = .cards

    private var topics: [Interest] { Interest.allCases.filter { $0 != .games && $0 != .estimation } }

    private func emoji(_ interest: Interest) -> String {
        switch interest {
        case .history: return "🏛️"
        case .science: return "🔭"
        case .money: return "🪙"
        case .tech: return "💡"
        case .mind: return "🧠"
        case .numbers: return "🔢"
        case .estimation: return "⚖️"
        case .games: return "🎮"
        }
    }

    var body: some View {
        VStack(spacing: 12) {
            Picker("What to pick", selection: Binding(
                get: { part },
                set: { newValue in
                    if newValue == .games { openGames() } else { part = newValue }
                }
            )) {
                Text("Cards").tag(Part.cards)
                Text("Math").tag(Part.math)
                Text("Games").tag(Part.games)
            }
            .pickerStyle(.segmented)

            ScrollView {
                VStack(spacing: 10) {
                    if part == .cards { cardRows } else { mathRows }
                }
                .padding(.bottom, 16)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .navigationTitle("Pick something specific")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var cardRows: some View {
        Group {
            ForEach(topics, id: \.self) { interest in
                let counts = model.topicCounts(interest)
                row(
                    leading: emoji(interest),
                    title: interest.displayName,
                    detail: "\(counts.cards) cards" + (counts.due > 0 ? " · \(counts.due) to review" : ""),
                    trailing: "Start"
                ) { start(.topic(interest), .learning) }
            }
            let due = model.dueCount
            row(
                leading: "🔁",
                title: "Check what stuck",
                detail: due > 0 ? "Only cards due for review (\(due))" : "Nothing due right now",
                trailing: due > 0 ? "Start" : ""
            ) { if due > 0 { start(.due, .learning) } }
        }
    }

    private var mathRows: some View {
        Group {
            ForEach(model.mathSkillsOn, id: \.self) { track in
                let status = model.skillStatus(track)
                row(
                    leading: nil,
                    title: Drills.info(track).name,
                    detail: status.attempts > 0 ? "Level \(status.level) of \(Drills.info(track).maxLevel)" : "Not started",
                    trailing: "Start"
                ) { start(.skill(track), .math) }
            }
            NavigationLink {
                MathSkillsView()
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Choose your skills").font(.headline).foregroundStyle(.primary)
                        Text("\(model.mathSkillsOn.count) of \(TrackId.allCases.count) on in your rounds").font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("Edit").font(.subheadline).foregroundStyle(.secondary)
                    Image(systemName: "chevron.right").font(.footnote).foregroundStyle(.secondary).accessibilityHidden(true)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .buttonStyle(.plain)
            .padding(.top, 6)
        }
    }

    private func row(leading: String?, title: String, detail: String, trailing: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                if let leading { Text(leading).font(.title).accessibilityHidden(true) }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.headline).foregroundStyle(.primary)
                    Text(detail).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                if !trailing.isEmpty {
                    Text(trailing).font(.subheadline.weight(.medium)).foregroundStyle(.teal)
                    Image(systemName: "chevron.right").font(.footnote).foregroundStyle(.teal).accessibilityHidden(true)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }
}
