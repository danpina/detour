import SwiftUI

/// The Games tab: games that build a skill, then games just for fun. Opening one takes over the screen until it calls onExit.
struct GamesView: View {
    @State private var playing: GameId?
    @State private var roundSize = GameStats.roundSize

    private let learning: [GameId] = [.spanish, .logic, .geo]
    private var fun: [GameId] { GameId.allCases.filter { !learning.contains($0) } }

    /// How far along you are in a learning game, or nil before you start.
    private func progressLine(_ game: GameId) -> String? {
        switch game {
        case .spanish:
            let words = SpanishData.load()
            let progress = SpanishStore.load()
            let learned = words.filter { (progress.known[$0.key] ?? 0) >= SpanishBuilder.learnedAt }.count
            return learned > 0 ? "\(learned) of \(words.count) words learned" : nil
        case .logic:
            let solved = LogicStore.load().solved.values.filter { $0 > 0 }.count
            return solved > 0 ? "\(solved) of \(LogicData.load().count) puzzles solved" : nil
        default:
            return nil
        }
    }

    private func row(_ game: GameId) -> some View {
        Button {
            playing = game
        } label: {
            HStack(spacing: 14) {
                Text(game.emoji).font(.largeTitle)
                VStack(alignment: .leading, spacing: 2) {
                    Text(game.name).font(.headline)
                    Text(progressLine(game) ?? game.blurb).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                if GameStats.plays(game) > 0 {
                    Text("Best \(GameStats.best(game))").font(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Puzzles per round", selection: Binding(
                        get: { roundSize },
                        set: { n in
                            roundSize = n
                            GameStats.roundSize = n
                        }
                    )) {
                        ForEach(GameStats.roundSizes, id: \.self) { Text("\($0)").tag($0) }
                    }
                    .pickerStyle(.segmented)
                } footer: {
                    Text("Short rounds keep a game to a minute. Memory plays this many sequences.")
                }

                Section("Learn") {
                    ForEach(learning) { row($0) }
                }
                Section("Just for fun") {
                    ForEach(fun) { row($0) }
                }
            }
            .navigationTitle("Games")
        }
        .fullScreenCover(item: $playing) { game in
            gameView(for: game, onExit: { playing = nil })
        }
    }
}
