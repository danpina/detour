import Foundation

/// One mating puzzle. `mates` lists the UCI of every legal move that checkmates (for a line: at its last move).
struct ChessPuzzle: Codable, Identifiable {
    let id: String
    let fen: String
    let sideToMove: String
    let mates: [String]
    let rating: Int
    /// Mate in two or three: your move, the opponent's reply, your next move, and so on. Your last move mates, and any move in
    /// `mates` counts. Missing for a mate in one.
    var line: [String]? = nil
}

struct ChessData: Codable {
    let credit: String
    let puzzles: [ChessPuzzle]
    /// Mates in two and three from real games. Older files have none.
    let hard: [ChessPuzzle]?

    /// The puzzles for a level ("easy" or "hard"). Falls back to the easy set when there is no hard one.
    func puzzles(forLevel level: String) -> [ChessPuzzle] {
        if level == "hard", let hard, !hard.isEmpty { return hard }
        return puzzles
    }

    private static let levelKey = "detour.games.chess.level"

    /// Easy until the player picks hard on the Games screen.
    static var currentLevel: String {
        get { UserDefaults.standard.string(forKey: levelKey) == "hard" ? "hard" : "easy" }
        set { UserDefaults.standard.set(newValue, forKey: levelKey) }
    }
}

struct ParsedFen {
    /// 64 entries, index 0 = a8, 7 = h8, 8 = a7 ... 63 = h1. A piece letter (uppercase = white) or nil.
    let squares: [Character?]
    /// "w" or "b"
    let sideToMove: String
}

enum ChessLogic {
    private static let files: [String] = ["a", "b", "c", "d", "e", "f", "g", "h"]

    /// Parses the first two FEN fields. Returns nil when the placement is not 8x8.
    static func parseFen(_ fen: String) -> ParsedFen? {
        let parts = fen.split(separator: " ").map { String($0) }
        guard let placement = parts.first else { return nil }
        let rows = placement.split(separator: "/", omittingEmptySubsequences: false).map { String($0) }
        if rows.count != 8 { return nil }
        var squares: [Character?] = []
        for row in rows {
            var count = 0
            for ch in row {
                if let n = ch.wholeNumberValue, n >= 1, n <= 8 {
                    for _ in 0..<n { squares.append(nil) }
                    count += n
                } else if "pnbrqkPNBRQK".contains(ch) {
                    squares.append(ch)
                    count += 1
                } else {
                    return nil
                }
            }
            if count != 8 { return nil }
        }
        var side = "w"
        if parts.count > 1 && parts[1] == "b" { side = "b" }
        return ParsedFen(squares: squares, sideToMove: side)
    }

    /// Square name for a board index (0 = a8).
    static func squareName(_ index: Int) -> String {
        let file = index % 8
        let rank = 8 - index / 8
        return files[file] + String(rank)
    }

    /// Board indexes in drawing order, row by row. The side to move is at the bottom.
    static func displayOrder(side: String) -> [Int] {
        var order: [Int] = []
        for i in 0..<64 {
            order.append(side == "w" ? i : 63 - i)
        }
        return order
    }

    /// Solid glyphs are used for both colours; the view tints them.
    static func glyph(_ piece: Character) -> String {
        switch Character(piece.lowercased()) {
        case "k": return "\u{265A}\u{FE0E}"
        case "q": return "\u{265B}\u{FE0E}"
        case "r": return "\u{265C}\u{FE0E}"
        case "b": return "\u{265D}\u{FE0E}"
        case "n": return "\u{265E}\u{FE0E}"
        default: return "\u{265F}\u{FE0E}"
        }
    }

    static func isWhite(_ piece: Character) -> Bool {
        return piece.isUppercase
    }

    static func isOwnPiece(_ piece: Character?, side: String) -> Bool {
        guard let piece = piece else { return false }
        return side == "w" ? piece.isUppercase : piece.isLowercase
    }

    /// The matching mating move (UCI) for a from/to tap, or nil. A promotion defaults to a queen.
    static func acceptMove(_ puzzle: ChessPuzzle, from: String, to: String) -> String? {
        let base = from + to
        if puzzle.mates.contains(base) { return base }
        if puzzle.mates.contains(base + "q") { return base + "q" }
        return nil
    }

    // MARK: Mates in two or three

    /// Board index (0 = a8) of a square name like "e4".
    static func squareIndex(_ name: String) -> Int {
        let chars = Array(name)
        guard chars.count == 2, let rank = chars[1].wholeNumberValue, let file = chars[0].asciiValue else { return 0 }
        return (8 - rank) * 8 + Int(file) - 97
    }

    /// The board after one move in UCI ("e2e4", "e7e8q"). The moves come from a puzzle's solution, so they are not checked for
    /// legality; castling, en passant and promotion are handled so the board stays right.
    static func applyUci(_ squares: [Character?], _ uci: String) -> [Character?] {
        var next = squares
        let chars = Array(uci)
        guard chars.count >= 4 else { return next }
        let from = squareIndex(String(chars[0...1]))
        let to = squareIndex(String(chars[2...3]))
        guard (0..<64).contains(from), (0..<64).contains(to), let piece = next[from] else { return next }
        let lower = Character(piece.lowercased())
        let rankStart = (from / 8) * 8
        if lower == "p" && from % 8 != to % 8 && next[to] == nil { next[rankStart + to % 8] = nil }
        if lower == "k" && abs(to % 8 - from % 8) == 2 {
            let kingside = to % 8 > from % 8
            let rookFrom = rankStart + (kingside ? 7 : 0)
            let rookTo = rankStart + (kingside ? 5 : 3)
            next[rookTo] = next[rookFrom]
            next[rookFrom] = nil
        }
        if chars.count > 4 {
            let promo = String(chars[4])
            next[to] = Character(piece.isUppercase ? promo.uppercased() : promo.lowercased())
        } else {
            next[to] = piece
        }
        next[from] = nil
        return next
    }

    /// The board after all of `moves` have been played from the starting squares.
    static func boardAfter(_ squares: [Character?], _ moves: [String]) -> [Character?] {
        moves.reduce(squares) { applyUci($0, $1) }
    }

    /// How many moves you play to mate: 1 for a mate in one, 2 or 3 for a line.
    static func matePlies(_ puzzle: ChessPuzzle) -> Int {
        guard let line = puzzle.line else { return 1 }
        return (line.count + 1) / 2
    }

    /// Whether the move at `ply` (moves played so far, including replies) is your mating move.
    static func isFinalStep(_ puzzle: ChessPuzzle, ply: Int) -> Bool {
        guard let line = puzzle.line else { return true }
        return ply >= line.count - 1
    }

    /// The move to play for a from/to tap at `ply`, or nil if it is not the right one. The last move may be any mate; earlier moves
    /// must be the puzzle's own, because only they lead where the line goes.
    static func acceptStep(_ puzzle: ChessPuzzle, ply: Int, from: String, to: String) -> String? {
        if isFinalStep(puzzle, ply: ply) { return acceptMove(puzzle, from: from, to: to) }
        guard let line = puzzle.line, line.indices.contains(ply) else { return nil }
        return String(line[ply].prefix(4)) == from + to ? line[ply] : nil
    }

    /// Share of the (easy to hard) puzzle list a round of this size may reach: short rounds stay gentle.
    static func rampShare(_ count: Int) -> Double {
        if count <= 2 { return 0.5 }
        if count <= 5 { return 0.75 }
        return 1.0
    }

    /// A round of `count` puzzles, easy to hard: one random pick from each difficulty band.
    static func buildRound(_ puzzles: [ChessPuzzle], count: Int = 10, rand: () -> Double = { Double.random(in: 0..<1) }) -> [ChessPuzzle] {
        let all = puzzles.sorted { $0.rating < $1.rating }
        if all.count <= count { return all }
        let usable = max(count, Int((Double(all.count) * rampShare(count)).rounded(.up)))
        let sorted = Array(all.prefix(usable))
        var round: [ChessPuzzle] = []
        for i in 0..<count {
            let start = (i * sorted.count) / count
            let end = max(start + 1, ((i + 1) * sorted.count) / count)
            let pick = start + Int(rand() * Double(end - start))
            round.append(sorted[min(pick, end - 1)])
        }
        return round
    }

    /// Loads the bundled puzzles; nil when the file is missing or unreadable.
    static func load() -> ChessData? {
        for bundle in [Bundle.main] + Bundle.allBundles {
            if let url = bundle.url(forResource: "chess", withExtension: "json", subdirectory: "games") {
                guard let data = try? Data(contentsOf: url) else { continue }
                if let decoded = try? JSONDecoder().decode(ChessData.self, from: data), !decoded.puzzles.isEmpty {
                    return decoded
                }
            }
        }
        return nil
    }
}
