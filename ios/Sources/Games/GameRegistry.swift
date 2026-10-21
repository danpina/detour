import SwiftUI

enum GameId: String, CaseIterable, Identifiable {
    case chess, patterns, words, geo, memory

    var id: String { rawValue }

    var name: String {
        switch self {
        case .chess: return "Chess tactics"
        case .patterns: return "What comes next?"
        case .words: return "Word scramble"
        case .geo: return "Geography"
        case .memory: return "Memory"
        }
    }

    var blurb: String {
        switch self {
        case .chess: return "Find the checkmate in one"
        case .patterns: return "Spot the pattern in a sequence"
        case .words: return "Unscramble the word"
        case .geo: return "Flags, capitals and more"
        case .memory: return "Remember digits and patterns"
        }
    }

    var emoji: String {
        switch self {
        case .chess: return "♟️"
        case .patterns: return "🔢"
        case .words: return "🔤"
        case .geo: return "🌍"
        case .memory: return "🧠"
        }
    }
}

/// Builds the screen for a game. A game fills the whole screen and calls `onExit` to go back to the Games list.
@ViewBuilder
func gameView(for id: GameId, onExit: @escaping () -> Void) -> some View {
    switch id {
    case .chess: ChessGameView(onExit: onExit)
    case .patterns: PatternsGameView(onExit: onExit)
    case .words: WordsGameView(onExit: onExit)
    case .geo: GeoGameView(onExit: onExit)
    case .memory: MemoryGameView(onExit: onExit)
    }
}
