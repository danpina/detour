import Foundation

/// One mate-in-one puzzle. `mates` lists the UCI of every legal move that checkmates.
struct ChessPuzzle: Codable, Identifiable {
    let id: String
    let fen: String
    let sideToMove: String
    let mates: [String]
    let rating: Int
}

struct ChessData: Codable {
    let credit: String
    let puzzles: [ChessPuzzle]
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

    /// A round of `count` puzzles, easy to hard: one random pick from each difficulty band.
    static func buildRound(_ puzzles: [ChessPuzzle], count: Int = 10, rand: () -> Double = { Double.random(in: 0..<1) }) -> [ChessPuzzle] {
        let sorted = puzzles.sorted { $0.rating < $1.rating }
        if sorted.count <= count { return sorted }
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
