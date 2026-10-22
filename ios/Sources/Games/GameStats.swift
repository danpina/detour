import Foundation

/// A tiny local scoreboard for the games: best score and rounds played, per game, on this device only.
enum GameStats {
    /// How many puzzles a round has. Short by default; changed on the Games screen.
    static let roundSizes = [2, 5, 10]
    static let defaultRoundSize = 2
    private static let roundKey = "detour.games.roundSize"

    static var roundSize: Int {
        get {
            let n = UserDefaults.standard.integer(forKey: roundKey)
            return roundSizes.contains(n) ? n : defaultRoundSize
        }
        set { UserDefaults.standard.set(newValue, forKey: roundKey) }
    }

    private static func bestKey(_ id: GameId) -> String { "detour.games.best." + id.rawValue }
    private static func playsKey(_ id: GameId) -> String { "detour.games.plays." + id.rawValue }

    static func best(_ id: GameId, defaults: UserDefaults = .standard) -> Int { defaults.integer(forKey: bestKey(id)) }
    static func plays(_ id: GameId, defaults: UserDefaults = .standard) -> Int { defaults.integer(forKey: playsKey(id)) }

    /// Records a finished round. Returns whether it is a new best.
    @discardableResult
    static func recordRound(_ id: GameId, score: Int, defaults: UserDefaults = .standard) -> Bool {
        let isBest = score > best(id, defaults: defaults)
        if isBest { defaults.set(score, forKey: bestKey(id)) }
        defaults.set(plays(id, defaults: defaults) + 1, forKey: playsKey(id))
        return isBest
    }
}
