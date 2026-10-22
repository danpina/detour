import Foundation

/// One "What comes next?" puzzle. Decoded from the bundled games/patterns.json (shared with the web app).
/// Extra fields in the file (family, params) are used only by the web tests and are ignored here.
struct PatternPuzzle: Decodable, Identifiable {
    let id: String
    let level: Int
    let shown: [Int]
    let answer: Int
    let options: [Int]
    let rule: String
}

private struct PatternsFile: Decodable {
    let puzzles: [PatternPuzzle]
}

enum PatternsData {
    /// Puzzles per level in a round of `size`, easiest first.
    /// 2: easy, medium. 5: one easy, two medium, two hard. 10: three easy, four medium, three hard.
    static func roundPlan(size: Int) -> [(level: Int, count: Int)] {
        if size <= 2 { return [(1, 1), (2, 1)] }
        if size <= 5 { return [(1, 1), (2, 2), (3, 2)] }
        return [(1, 3), (2, 4), (3, 3)]
    }

    /// Loads the bundled puzzles. Returns an empty list (never crashes) if the file is missing or unreadable.
    static func load() -> [PatternPuzzle] {
        var bundles: [Bundle] = [Bundle.main]
        bundles.append(contentsOf: Bundle.allBundles)
        for bundle in bundles {
            guard let url = bundle.url(forResource: "patterns", withExtension: "json", subdirectory: "games") else { continue }
            do {
                let data = try Data(contentsOf: url)
                return try JSONDecoder().decode(PatternsFile.self, from: data).puzzles
            } catch {
                continue
            }
        }
        return []
    }

    /// A round: puzzles ramp from level 1 to 3; within a level the pick and order are random so rounds differ.
    static func buildRound(from puzzles: [PatternPuzzle], size: Int) -> [PatternPuzzle] {
        var round: [PatternPuzzle] = []
        for step in roundPlan(size: size) {
            let atLevel = puzzles.filter { $0.level == step.level }.shuffled()
            round.append(contentsOf: atLevel.prefix(step.count))
        }
        return round
    }
}
