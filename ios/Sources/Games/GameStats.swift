import Foundation

/// A tiny local scoreboard for the games: best score and rounds played, per game, on this device only.
enum GameStats {
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
