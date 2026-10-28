import SwiftUI

enum GameId: String, CaseIterable, Identifiable {
    case chess, patterns, words, geo, memory, languages, logic, map

    var id: String { rawValue }

    var name: String {
        switch self {
        case .chess: return "Chess tactics"
        case .patterns: return "What comes next?"
        case .words: return "Word scramble"
        case .geo: return "Geography"
        case .memory: return "Memory"
        case .languages: return "Languages"
        case .logic: return "Logic"
        case .map: return "Map"
        }
    }

    var blurb: String {
        switch self {
        case .chess: return "Find the checkmate, in one move or more"
        case .patterns: return "Spot the pattern in a sequence"
        case .words: return "Unscramble the word"
        case .geo: return "Flags, capitals and more"
        case .memory: return "Remember digits and patterns"
        case .languages: return "Spanish, French or German, words that stick"
        case .logic: return "Reason it out and spot the flaw"
        case .map: return "Find countries, rivers and mountains"
        }
    }

    /// A random game for a set of cards.
    static func random() -> GameId { allCases.randomElement() ?? .patterns }

    var emoji: String {
        switch self {
        case .chess: return "♟️"
        case .patterns: return "🔢"
        case .words: return "🔤"
        case .geo: return "🌍"
        case .memory: return "🧠"
        case .languages: return "🗣️"
        case .logic: return "🧩"
        case .map: return "🗺️"
        }
    }
}

/// Builds the screen for a game. A game fills the whole screen and calls `onExit` to go back to the Games list.
/// With `embedded` set the game is played inside a set of cards: it plays a short round, skips its own end screen and calls
/// `embedded(score)` when it is done. `onExit` then means "skip".
@ViewBuilder
func gameView(for id: GameId, onExit: @escaping () -> Void, embedded: ((Int) -> Void)? = nil) -> some View {
    switch id {
    case .chess: ChessGameView(onExit: onExit, embedded: embedded)
    case .patterns: PatternsGameView(onExit: onExit, embedded: embedded)
    case .words: WordsGameView(onExit: onExit, embedded: embedded)
    case .geo: GeoGameView(onExit: onExit, embedded: embedded)
    case .memory: MemoryGameView(onExit: onExit, embedded: embedded)
    case .languages: LanguageGameView(onExit: onExit, embedded: embedded)
    case .logic: LogicGameView(onExit: onExit, embedded: embedded)
    case .map: MapGameView(onExit: onExit, embedded: embedded)
    }
}
