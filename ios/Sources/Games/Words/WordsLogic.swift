import Foundation

/// One Word scramble puzzle, as written by tools/src/games/words-gen.ts into content/games/words.json.
struct WordPuzzle: Decodable, Identifiable {
    let id: String
    /// UPPERCASE letters, shuffled so they differ from every accepted word.
    let scramble: String
    let answer: String
    /// Every word in the list that is an anagram of the same letters (includes `answer`).
    let accept: [String]
    let clue: String
    let level: Int
}

struct WordsFile: Decodable {
    let puzzles: [WordPuzzle]
}

/// Pure logic for Word scramble (no SwiftUI), so it can be unit tested.
enum WordsLogic {
    /// Difficulty ramp for one round of 8 words.
    static let roundLevels: [Int] = [1, 1, 2, 2, 2, 3, 3, 3]

    static func decode(_ data: Data) -> [WordPuzzle] {
        do {
            return try JSONDecoder().decode(WordsFile.self, from: data).puzzles
        } catch {
            return []
        }
    }

    /// Finds games/words.json in the app bundle (or any loaded bundle, so it also works in unit tests).
    static func wordsURL() -> URL? {
        for bundle in [Bundle.main] + Bundle.allBundles {
            if let url = bundle.url(forResource: "words", withExtension: "json", subdirectory: "games") {
                return url
            }
        }
        return nil
    }

    /// All bundled puzzles. Empty (never crashes) if the file is missing or malformed.
    static func loadPuzzles() -> [WordPuzzle] {
        guard let url = wordsURL() else { return [] }
        guard let data = try? Data(contentsOf: url) else { return [] }
        return decode(data)
    }

    /// Picks 8 puzzles ramping from level 1 to 3. Two puzzles from the same anagram family never share a round.
    /// If a level runs short it borrows from the nearest other level.
    static func buildRound<G: RandomNumberGenerator>(_ puzzles: [WordPuzzle], using rng: inout G) -> [WordPuzzle] {
        var picked: [WordPuzzle] = []
        var usedIds = Set<String>()
        var usedWords = Set<String>()
        for level in roundLevels {
            var order: [Int] = [level]
            let others = [1, 2, 3].filter { $0 != level }.sorted { abs($0 - level) < abs($1 - level) }
            order.append(contentsOf: others)
            var chosen: WordPuzzle? = nil
            for candidateLevel in order {
                let pool = puzzles.filter { puzzle in
                    puzzle.level == candidateLevel
                        && !usedIds.contains(puzzle.id)
                        && !puzzle.accept.contains(where: { usedWords.contains($0) })
                }
                if let found = pool.randomElement(using: &rng) {
                    chosen = found
                    break
                }
            }
            if let puzzle = chosen {
                picked.append(puzzle)
                usedIds.insert(puzzle.id)
                for word in puzzle.accept { usedWords.insert(word) }
            }
        }
        return picked
    }

    // MARK: Tile placement. `placed` holds tile indexes (into the scramble) in slot order, always contiguous.

    static func placeTile(_ placed: [Int], tile: Int, slots: Int) -> [Int] {
        if placed.contains(tile) || placed.count >= slots { return placed }
        return placed + [tile]
    }

    /// Taking a letter back from `slot` shifts the later letters left.
    static func removeSlot(_ placed: [Int], slot: Int) -> [Int] {
        var result = placed
        if slot >= 0 && slot < result.count { result.remove(at: slot) }
        return result
    }

    static func letters(of scramble: String, placed: [Int]) -> String {
        let chars = Array(scramble)
        var result = ""
        for index in placed {
            if index >= 0 && index < chars.count { result.append(chars[index]) }
        }
        return result
    }

    static func isCorrect(_ puzzle: WordPuzzle, guess: String) -> Bool {
        return puzzle.accept.contains(guess.uppercased())
    }

    /// 1 point for a word solved with no hint; a hint costs that point; a skip earns nothing.
    static func wordPoints(solved: Bool, usedHint: Bool) -> Int {
        return (solved && !usedHint) ? 1 : 0
    }
}
