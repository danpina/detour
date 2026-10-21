import Foundation

/// Pure logic for the Memory game: no timers, no UI.
enum MemoryLogic {
    static let startLength = 3
    static let maxMisses = 2
    static let gridTiles = 9

    /// Picks a number in 0..<count. Injectable so tests can be deterministic.
    typealias Picker = (Int) -> Int

    static let systemPicker: Picker = { count in
        return Int.random(in: 0..<count)
    }

    private static func clamp(_ value: Int, _ count: Int) -> Int {
        return min(count - 1, max(0, value))
    }

    /// Random digits 0-9.
    static func generateDigits(length: Int, pick: Picker = MemoryLogic.systemPicker) -> [Int] {
        var out: [Int] = []
        var i = 0
        while i < length {
            out.append(clamp(pick(10), 10))
            i += 1
        }
        return out
    }

    /// Random tile indexes; the same tile never lights twice in a row.
    static func generateTiles(length: Int, tileCount: Int = MemoryLogic.gridTiles, pick: Picker = MemoryLogic.systemPicker) -> [Int] {
        var out: [Int] = []
        var i = 0
        while i < length {
            var next = clamp(pick(tileCount), tileCount)
            if tileCount > 1, let last = out.last, next == last {
                next = (next + 1 + clamp(pick(tileCount - 1), tileCount - 1)) % tileCount
            }
            out.append(next)
            i += 1
        }
        return out
    }

    static func checkAnswer(expected: [Int], given: [Int]) -> Bool {
        return expected == given
    }

    /// True while the player's input so far is still the start of the answer.
    static func isPrefix(expected: [Int], given: [Int]) -> Bool {
        if given.count > expected.count { return false }
        var i = 0
        while i < given.count {
            if given[i] != expected[i] { return false }
            i += 1
        }
        return true
    }

    struct Run: Equatable {
        /// Length of the next sequence to show.
        var length: Int = MemoryLogic.startLength
        /// Misses in a row.
        var misses: Int = 0
        /// Longest sequence recalled so far (the score).
        var best: Int = 0
        /// Round counter, starting at 1.
        var round: Int = 1
        var over: Bool = false
    }

    /// Applies the result of one round. A success grows the sequence; two misses in a row end the run.
    static func apply(_ run: Run, success: Bool) -> Run {
        var next = run
        next.round = run.round + 1
        if success {
            next.best = max(run.best, run.length)
            next.length = run.length + 1
            next.misses = 0
            next.over = false
        } else {
            next.misses = run.misses + 1
            next.over = next.misses >= maxMisses
        }
        return next
    }
}
