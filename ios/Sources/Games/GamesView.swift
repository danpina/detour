import SwiftUI

/// The Games tab: a short list of games. Opening one takes over the screen until it calls onExit.
struct GamesView: View {
    @State private var playing: GameId?
    @State private var roundSize = GameStats.roundSize

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

                ForEach(GameId.allCases) { game in
                Button {
                    playing = game
                } label: {
                    HStack(spacing: 14) {
                        Text(game.emoji).font(.largeTitle)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(game.name).font(.headline)
                            Text(game.blurb).font(.subheadline).foregroundStyle(.secondary)
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
            }
            .navigationTitle("Games")
        }
        .fullScreenCover(item: $playing) { game in
            gameView(for: game, onExit: { playing = nil })
        }
    }
}
