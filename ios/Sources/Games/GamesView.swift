import SwiftUI

/// The Games tab: games that build a skill, then games just for fun. Opening one takes over the screen until it calls onExit.
struct GamesView: View {
    @State private var playing: GameId?
    @State private var roundSize = GameStats.roundSize
    @State private var language = LanguageInfo.current

    private let learning: [GameId] = [.languages, .logic, .geo]
    private var fun: [GameId] { GameId.allCases.filter { !learning.contains($0) } }

    /// How far along you are in a learning game, or nil before you start.
    private func progressLine(_ game: GameId) -> String? {
        switch game {
        case .languages:
            let words = LanguageData.load(language)
            let progress = LanguageStore.load(language)
            let learned = words.filter { (progress.known[$0.key] ?? 0) >= LanguageBuilder.learnedAt }.count
            return learned > 0 ? "\(language.name): \(learned) of \(words.count) words learned" : nil
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
                if let best = GameStats.bestLabel(game) {
                    Text("Best " + best).font(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }

    /// Spanish, French or German: the choice is kept, and the game plays the language shown here.
    private var languagePicker: some View {
        Picker("Language", selection: Binding(
            get: { language.id },
            set: { id in
                language = LanguageInfo.info(for: id)
                LanguageInfo.current = language
            }
        )) {
            ForEach(LanguageInfo.all) { info in
                Text(info.flag + " " + info.name).tag(info.id)
            }
        }
        .pickerStyle(.segmented)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("Puzzles per round")
                            Spacer()
                            Text("\(roundSize)").font(.headline.monospacedDigit())
                        }
                        Slider(
                            value: Binding(
                                get: { Double(roundSize) },
                                set: { value in
                                    let n = Int(value.rounded())
                                    roundSize = n
                                    GameStats.roundSize = n
                                }
                            ),
                            in: Double(GameStats.roundSizeRange.lowerBound)...Double(GameStats.roundSizeRange.upperBound),
                            step: 1
                        )
                        .accessibilityLabel("Puzzles per round")
                    }
                } footer: {
                    Text("Short rounds keep a game to a minute. Memory plays this many sequences.")
                }

                Section("Learn") {
                    ForEach(learning) { game in
                        row(game)
                        if game == .languages { languagePicker }
                    }
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
