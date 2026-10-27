import SwiftUI

/// The home screen: three rounds, each with its own place. Learning (cards), Math (skills with levels) and Games.
struct HomeView: View {
    let start: (_ kind: AppModel.RoundKind) -> Void

    var body: some View {
        VStack(spacing: 12) {
            Spacer()
            Text("Quick one?").font(.largeTitle.weight(.semibold))
            Text("Pick a round. About a minute.").foregroundStyle(.secondary)
            RoundChoiceList(start: start).padding(.top, 14)
            Spacer()
        }
        .padding(.horizontal, 24)
    }
}

/// The three rounds, asked every time: when you open Detour from a guarded app, and after you finish a round.
struct RoundChooserView: View {
    let title: String
    let subtitle: String
    let closeLabel: String
    let start: (_ kind: AppModel.RoundKind) -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Spacer()
            Text(title).font(.largeTitle.weight(.semibold))
            Text(subtitle).foregroundStyle(.secondary).multilineTextAlignment(.center)
            RoundChoiceList(start: start).padding(.top, 14)
            Button(closeLabel, action: onClose)
                .padding(.top, 8)
            Spacer()
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground).ignoresSafeArea())
    }
}

/// The three round buttons, shared by the home screen and the choice shown from the shield.
struct RoundChoiceList: View {
    @Environment(AppModel.self) private var model
    let start: (_ kind: AppModel.RoundKind) -> Void

    private struct Round: Identifiable {
        let kind: AppModel.RoundKind
        let emoji: String
        let title: String
        let blurb: String
        var id: String { kind.rawValue }
    }

    private var rounds: [Round] {
        [
            Round(
                kind: .learning, emoji: "📚", title: "Learning round",
                blurb: model.dueCount > 0
                    ? "\(model.settings.setSize) small cards. \(model.dueCount) to check if they stuck."
                    : "\(model.settings.setSize) small cards to learn something new."
            ),
            Round(kind: .math, emoji: "🔢", title: "Math round", blurb: "\(model.settings.setSize) quick problems · level \(model.mathLevel)"),
            Round(kind: .games, emoji: "🎮", title: "Game round", blurb: "\(model.settings.setSize) quick games: language, map, chess and more."),
        ]
    }

    var body: some View {
        VStack(spacing: 12) {
            ForEach(rounds) { round in
                Button {
                    start(round.kind)
                } label: {
                    HStack(spacing: 14) {
                        Text(round.emoji).font(.largeTitle)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(round.title).font(.headline)
                            Text(round.blurb).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.leading)
                        }
                        Spacer()
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
            }
        }
    }
}
