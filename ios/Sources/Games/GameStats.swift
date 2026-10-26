import Foundation

/// A tiny local scoreboard for the games: the best round and rounds played, per game, on this device only.
/// A best is kept together with the length of the round it came from ("4/5"), so rounds of different lengths never get mixed up.
enum GameStats {
    /// How many puzzles a round has: 1 to 20, short by default; changed on the Games screen.
    static let roundSizeRange = 1...20
    static let defaultRoundSize = 2
    private static let roundKey = "detour.games.roundSize"

    static var roundSize: Int {
        get {
            let n = UserDefaults.standard.integer(forKey: roundKey)
            return roundSizeRange.contains(n) ? n : defaultRoundSize
        }
        set { UserDefaults.standard.set(min(roundSizeRange.upperBound, max(roundSizeRange.lowerBound, newValue)), forKey: roundKey) }
    }

    /// A game played inside a Game round plays one puzzle, so a round of N games takes about as long as N cards.
    static let embeddedRoundSize = 1

    /// How many puzzles a game plays: one inside a Game round, otherwise the size chosen on the Games screen.
    static func size(embedded: Bool) -> Int { embedded ? embeddedRoundSize : roundSize }

    private static func bestKey(_ id: GameId) -> String { "detour.games.best." + id.rawValue }
    private static func ofKey(_ id: GameId) -> String { "detour.games.bestOf." + id.rawValue }
    private static func playsKey(_ id: GameId) -> String { "detour.games.plays." + id.rawValue }

    static func best(_ id: GameId, defaults: UserDefaults = .standard) -> Int { defaults.integer(forKey: bestKey(id)) }
    static func plays(_ id: GameId, defaults: UserDefaults = .standard) -> Int { defaults.integer(forKey: playsKey(id)) }

    /// Whether a round of `score` out of `of` beats the saved best. `savedOf` is nil for an older save without a round length.
    /// Runs (of = 0, such as digits remembered in a row) compare plain scores.
    static func beats(score: Int, of: Int, savedBest: Int, savedOf: Int?) -> Bool {
        guard let savedOf else { return true }
        if of == 0 || savedOf == 0 { return score > savedBest }
        let mine = score * savedOf
        let theirs = savedBest * of
        return mine > theirs || (mine == theirs && of > savedOf)
    }

    /// Records a finished round of `score` out of `of` puzzles (0 for a run). Returns whether it is a new best.
    @discardableResult
    static func recordRound(_ id: GameId, score: Int, of: Int = GameStats.roundSize, defaults: UserDefaults = .standard) -> Bool {
        let savedOf = defaults.object(forKey: ofKey(id)) as? Int
        let isBest = score > 0 && beats(score: score, of: of, savedBest: best(id, defaults: defaults), savedOf: savedOf)
        if isBest {
            defaults.set(score, forKey: bestKey(id))
            defaults.set(of, forKey: ofKey(id))
        }
        defaults.set(plays(id, defaults: defaults) + 1, forKey: playsKey(id))
        return isBest
    }

    /// "4/5", "7 in a row", or nil when there is no best yet.
    static func bestLabel(_ id: GameId, defaults: UserDefaults = .standard) -> String? {
        guard let of = defaults.object(forKey: ofKey(id)) as? Int else { return nil }
        let score = best(id, defaults: defaults)
        guard score > 0 else { return nil }
        return of == 0 ? "\(score) in a row" : "\(score)/\(of)"
    }
}
